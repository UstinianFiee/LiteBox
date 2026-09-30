"use strict";
const { Server, utils } = require("ssh2");
const path = require("node:path");
exports.start = async () => {
  const key = utils.generateKeyPairSync("ed25519");
  const clientKey = utils.generateKeyPairSync("ed25519");
  const parsedKey = utils.parseKey(clientKey.private);
  const clients = new Set();
  const files = new Map([["/note.txt", Buffer.from("hello from mock SSH")]]);
  const attrs = (name) => ({
    mode: name === "/" ? 0o40755 : 0o100644,
    uid: 1000,
    gid: 1000,
    size: files.get(name)?.length || 0,
    atime: 1,
    mtime: 1,
  });
  const srv = new Server({ hostKeys: [key.private] }, (client) => {
    clients.add(client);
    client.on("error", () => {}).on("close", () => clients.delete(client));
    client.on("authentication", (ctx) => {
      const password =
        ctx.method === "password" && ctx.password === "synthetic-password";
      const key =
        ctx.method === "publickey" &&
        ctx.key.data.equals(parsedKey.getPublicSSH()) &&
        (!ctx.signature || parsedKey.verify(ctx.blob, ctx.signature) === true);
      ctx.username === "tester" && (password || key)
        ? ctx.accept()
        : ctx.reject();
    });
    client.on("ready", () =>
      client.on("session", (accept) => {
        const session = accept();
        session.on("pty", (accept) => accept());
        session.on("window-change", (accept) => accept?.());
        session.on("shell", (accept) => {
          const stream = accept();
          stream.write(
            "mock ready\r\n\x1b[31mERROR fixture timeout\x1b[0m\r\n\x1b[32mOK fixture\x1b[0m\r\n",
          );
          stream.on("data", (data) => stream.write("echo: " + data));
        });
        session.on("sftp", (accept) => {
          const s = accept();
          let next = 0;
          const handles = new Map();
          const handle = (id, value) => {
            const b = Buffer.alloc(4);
            b.writeUInt32BE(++next);
            handles.set(next, value);
            s.handle(id, b);
          };
          const get = (h) => handles.get(h.readUInt32BE());
          s.on("REALPATH", (id, p) => {
            const name = path.posix.resolve("/", p);
            s.name(id, [
              { filename: name, longname: name, attrs: attrs(name) },
            ]);
          });
          s.on("STAT", (id, p) =>
            files.has(p) || p === "/" ? s.attrs(id, attrs(p)) : s.status(id, 2),
          );
          s.on("LSTAT", (id, p) =>
            files.has(p) || p === "/" ? s.attrs(id, attrs(p)) : s.status(id, 2),
          );
          s.on("OPENDIR", (id, p) =>
            p === "/"
              ? handle(id, { dir: true, read: false })
              : s.status(id, 2),
          );
          s.on("READDIR", (id, h) => {
            const v = get(h);
            if (v.read) return s.status(id, 1);
            v.read = true;
            s.name(
              id,
              [...files.keys()].map((p) => ({
                filename: p.slice(1),
                longname: p,
                attrs: attrs(p),
              })),
            );
          });
          s.on("OPEN", (id, p, flags) => {
            if (flags & 8) {
              if (flags & 32 && files.has(p)) return s.status(id, 4);
              files.set(p, Buffer.alloc(0));
            }
            if (!files.has(p)) return s.status(id, 2);
            handle(id, { path: p });
          });
          s.on("READ", (id, h, offset, len) => {
            const b = files.get(get(h).path);
            offset >= b.length
              ? s.status(id, 1)
              : s.data(id, b.subarray(offset, offset + len));
          });
          s.on("WRITE", (id, h, offset, data) => {
            const p = get(h).path;
            const old = files.get(p);
            const b = Buffer.alloc(Math.max(old.length, offset + data.length));
            old.copy(b);
            data.copy(b, offset);
            files.set(p, b);
            s.status(id, 0);
          });
          s.on("FSTAT", (id, h) => s.attrs(id, attrs(get(h).path)));
          s.on("SETSTAT", (id) => s.status(id, 0));
          s.on("FSETSTAT", (id) => s.status(id, 0));
          s.on("CLOSE", (id, h) => {
            handles.delete(h.readUInt32BE());
            s.status(id, 0);
          });
          s.on("REMOVE", (id, p) => {
            files.delete(p);
            s.status(id, 0);
          });
          s.on("RENAME", (id, a, b) => {
            files.set(b, files.get(a));
            files.delete(a);
            s.status(id, 0);
          });
          // Deliberately no posix-rename extension: exercises refusal to fall back to truncating writes.
        });
      }),
    );
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  return {
    port: srv.address().port,
    files,
    clientPrivateKey: clientKey.private,
    close() {
      for (const c of clients) c.end();
      srv.close();
    },
  };
};
