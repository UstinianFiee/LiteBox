const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
exports.run = async ({ win, js, click, waitHeading, check, dataDir }) => {
  const wait = (condition) =>
    js(
      `new Promise((resolve,reject)=>{let n=0;const poll=()=>(${condition})?resolve(true):++n>300?reject(Error('Image test timed out: '+${JSON.stringify(condition)})):setTimeout(poll,20);poll()})`,
    );
  const chooseFormat = async (label) => {
    await js(`document.querySelector('[aria-label="输出图片格式"]').click()`);
    await wait(`!!document.querySelector(':popover-open')`);
    await js(
      `[...document.querySelectorAll(':popover-open [role=option]')].find(e=>e.textContent.trim()===${JSON.stringify(label)}).click()`,
    );
  };
  const run = async () => {
    await click("处理全部图片");
    await wait(
      `document.querySelectorAll('.image-queue-row').length===2 && [...document.querySelectorAll('.image-state')].every(e=>e.textContent.includes('已完成')||e.textContent.includes('失败'))`,
    );
  };
  const resultPixels = () =>
    js(`(async()=>{
    const image=document.querySelector('img[alt="处理结果预览"]'); await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
    return {width:image.naturalWidth,height:image.naturalHeight,pixel:[...ctx.getImageData(0,0,1,1).data],type:window.__imageSmokeTypes.get(image.src)};
  })()`);
  await js(`document.querySelector('[data-page="images"]').click()`);
  await waitHeading("图片工坊");
  await js(
    `window.__imageSmokeTypes=new Map();window.__imageSmokeCreate=URL.createObjectURL;URL.createObjectURL=(blob)=>{const url=window.__imageSmokeCreate(blob);window.__imageSmokeTypes.set(url,blob.type);return url;};true`,
  );
  await check(
    "image studio imports batches, blocks unsupported files and requires static-export acknowledgement",
    async () => {
      await js(`(async()=>{
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#165dce';ctx.fillRect(100,100,400,280);
      const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
      const files=new DataTransfer();files.items.add(new File([blob],'transparent.png',{type:'image/png'}));
      files.items.add(new File([new Uint8Array([137,80,78,71,13,10,26,10])],'broken.png',{type:'image/png'}));
      files.items.add(new File(['not an image'],'fake.jpg',{type:'image/jpeg'}));
      const input=document.querySelector('.image-file-input');input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
      await wait(`document.querySelectorAll('.image-queue-row').length===2`);
      assert.equal(
        await js(
          `[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='处理全部图片').disabled`,
        ),
        true,
      );
      await js(`document.querySelector('.image-ack input').click()`);
      await run();
      assert.match(
        await js(`document.querySelectorAll('.image-state')[1].textContent`),
        /失败/,
      );
      const pixels = await resultPixels();
      assert.deepEqual(pixels, {
        width: 640,
        height: 480,
        pixel: [0, 0, 0, 0],
        type: "image/png",
      });
      assert.match(
        await js(`document.querySelector('.image-error').textContent`),
        /无法读取/,
      );
    },
  );
  await check(
    "image studio clears stale output and performs JPEG resize with white transparency fill",
    async () => {
      await chooseFormat("JPG / JPEG");
      assert.equal(
        await js(`document.querySelector('img[alt="处理结果预览"]')===null`),
        true,
      );
      await js(
        `document.querySelector('.image-settings input[type=checkbox]').click()`,
      );
      await js(
        `(()=>{const e=document.querySelector('.image-settings input[type=number]');e.value='320';e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
      );
      await run();
      const pixels = await resultPixels();
      assert.equal(pixels.type, "image/jpeg");
      assert.equal(pixels.width, 320);
      assert.equal(pixels.height, 240);
      assert(pixels.pixel.slice(0, 3).every((v) => v >= 250));
      assert.equal(pixels.pixel[3], 255);
    },
  );
  await check(
    "image studio exports actual WebP bytes and keeps its queue across navigation",
    async () => {
      await chooseFormat("WebP");
      await run();
      assert.equal((await resultPixels()).type, "image/webp");
      const destination = path.join(dataDir, "image-export.webp");
      const downloaded = new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(Error("Image download timed out")),
          5000,
        );
        win.webContents.session.once("will-download", (_event, item) => {
          item.setSavePath(destination);
          item.once("done", (_event, state) => {
            clearTimeout(timeout);
            state === "completed" ? resolve() : reject(Error(state));
          });
        });
      });
      await click("下载结果");
      await downloaded;
      const history = await js(`window.litebox.invoke('activity:list')`);
      assert(
        history.records.some(
          (r) => r.module === "images" && r.action === "run",
        ),
      );
      assert(!history.error);
      const bytes = fs.readFileSync(destination);
      assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
      assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
      await js(`document.querySelector('[data-page="orders"]').click()`);
      await waitHeading("文本整理");
      await js(`document.querySelector('[data-page="images"]').click()`);
      await waitHeading("图片工坊");
      assert.equal(
        await js(`document.querySelectorAll('.image-queue-row').length`),
        2,
      );
      assert.equal((await resultPixels()).type, "image/webp");
      fs.writeFileSync(
        path.join(dataDir, "image-studio.png"),
        (await win.webContents.capturePage()).toPNG(),
      );
      await click("清空");
      assert.equal(
        await js(`document.querySelectorAll('.image-queue-row').length`),
        0,
      );
    },
  );
  await js(
    `URL.createObjectURL=window.__imageSmokeCreate;delete window.__imageSmokeCreate;delete window.__imageSmokeTypes;`,
  );
  await click("工作台");
  await waitHeading("工具就位");
};
