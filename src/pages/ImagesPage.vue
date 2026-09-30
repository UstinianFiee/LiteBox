<script setup lang="ts">
import { computed, ref } from "vue";
import {
  ImagePlus,
  Upload,
  Download,
  Trash2,
  SlidersHorizontal,
  ShieldCheck,
  ArrowRight,
  Images,
  CircleCheck,
  AlertCircle,
} from "lucide-vue-next";
import AppSelect from "../components/AppSelect.vue";
import { t } from "../lib/store";
import { IMAGE_ACCEPT, formatBytes } from "../lib/images";
import { useImageStudio } from "../lib/useImageStudio";
defineOptions({ name: "ImagesPage" });
const {
  items,
  selected,
  current,
  busy,
  importing,
  cancelled,
  acknowledged,
  options,
  completed,
  totals,
  add,
  run,
  remove,
  clear,
  download,
  errorText,
} = useImageStudio();
const picker = ref<HTMLInputElement>();
const dragging = ref(false);
const preview = ref("compare");
const resized = ref(false);
const locked = computed(() => busy.value || importing.value);
const savings = computed(() =>
  totals.value.before
    ? Math.round((1 - totals.value.after / totals.value.before) * 100)
    : 0,
);
function choose(event: Event) {
  const input = event.target as HTMLInputElement;
  void add(Array.from(input.files || []));
  input.value = "";
}
function drop(event: DragEvent) {
  dragging.value = false;
  if (event.dataTransfer) void add(Array.from(event.dataTransfer.files));
}
function resizeToggle() {
  options.value.maxEdge = resized.value ? 1920 : 0;
}
</script>

<template>
  <div class="page image-studio">
    <div class="page-heading">
      <div>
        <div class="eyebrow">IMAGE / LESS IS MORE</div>
        <h1>{{ t("图片工坊", "Image studio") }}</h1>
        <p>
          {{
            t(
              "让图片轻一点，让细节留下来。",
              "Less weight. More of the detail that matters.",
            )
          }}
        </p>
      </div>
      <div class="image-local">
        <ShieldCheck :size="17" />{{
          t("本机处理 · 无需上传", "Local processing · no uploads")
        }}
      </div>
    </div>
    <input
      ref="picker"
      class="image-file-input"
      type="file"
      multiple
      :accept="IMAGE_ACCEPT"
      :disabled="locked"
      :aria-label="t('选择图片文件', 'Choose image files')"
      @change="choose"
    />
    <div class="image-workspace">
      <section class="image-main">
        <button
          class="image-drop"
          :class="{ dragging }"
          :disabled="locked"
          @click="picker?.click()"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent.stop="drop"
        >
          <span class="image-drop-icon"
            ><ImagePlus :size="30" :stroke-width="1.5"
          /></span>
          <span
            ><strong>{{
              importing
                ? t("正在读取…", "Reading…")
                : t("拖入图片，或点击选择", "Drop images here, or browse")
            }}</strong
            ><small
              >JPG · PNG · WebP · BMP · GIF<br />{{
                t(
                  "最多 20 张 · 单张 ≤20 MB · 总计 ≤100 MB · ≤2400 万像素",
                  "Up to 20 images · 20 MB each · 100 MB total · 24 MP",
                )
              }}</small
            ></span
          >
          <Upload :size="19" />
        </button>
        <section v-if="!items.length" class="panel image-intro">
          <div class="image-intro-art" aria-hidden="true">
            <Images :size="72" :stroke-width="1" />
          </div>
          <h2>{{ t("从一张好图片开始", "Start with a good image") }}</h2>
          <p>
            {{
              t(
                "保画质压缩、常用格式互转、按比例缩小。原图始终保留，满意后再下载。",
                "Compress with quality in mind, switch formats, or resize proportionally. Keep your original and download when satisfied.",
              )
            }}
          </p>
          <div class="image-feature-row">
            <span>01 / {{ t("选择图片", "Add images") }}</span
            ><ArrowRight :size="16" /><span
              >02 / {{ t("调整参数", "Fine-tune") }}</span
            ><ArrowRight :size="16" /><span
              >03 / {{ t("预览下载", "Review & save") }}</span
            >
          </div>
        </section>
        <section v-else class="panel image-results">
          <div class="panel-heading">
            <h2>
              {{ t("图片队列", "Image queue") }}
              <small>{{ completed.length }} / {{ items.length }}</small>
            </h2>
            <button class="text-button" :disabled="locked" @click="clear">
              <Trash2 :size="15" />{{ t("清空", "Clear") }}
            </button>
          </div>
          <div class="image-queue">
            <div
              v-for="item in items"
              :key="item.id"
              class="image-queue-row"
              :class="{ selected: selected === item.id }"
            >
              <button
                class="image-file-select"
                :aria-pressed="selected === item.id"
                @click="selected = item.id"
              >
                <img :src="item.sourceUrl" alt="" loading="lazy" />
                <span
                  ><strong :title="item.file.name">{{ item.file.name }}</strong
                  ><small
                    >{{ formatBytes(item.file.size)
                    }}<template v-if="item.result">
                      → {{ formatBytes(item.result.blob.size) }} ·
                      {{ item.result.width }} ×
                      {{ item.result.height }}</template
                    ></small
                  ><small v-if="item.error" class="image-error">{{
                    errorText(item.error)
                  }}</small></span
                >
              </button>
              <span class="image-state" aria-live="polite"
                ><CircleCheck
                  v-if="item.status === 'done'"
                  :size="15"
                /><AlertCircle v-if="item.status === 'error'" :size="15" />{{
                  item.status === "processing"
                    ? t("处理中…", "Processing…")
                    : item.status === "done"
                      ? t("已完成", "Done")
                      : item.status === "error"
                        ? t("失败", "Failed")
                        : t("待处理", "Ready")
                }}</span
              >
              <button
                class="icon-button"
                :disabled="!item.result || busy"
                :aria-label="
                  t('下载处理结果：', 'Download result: ') + item.file.name
                "
                @click="download(item)"
              >
                <Download :size="17" />
              </button>
              <button
                class="icon-button"
                :disabled="locked"
                :aria-label="t('移除：', 'Remove: ') + item.file.name"
                @click="remove(item.id)"
              >
                <Trash2 :size="16" />
              </button>
            </div>
          </div>
          <div v-if="current" class="image-preview-area">
            <div class="image-preview-heading">
              <h2>{{ t("画质预览", "Quality preview") }}</h2>
              <AppSelect
                v-model="preview"
                :aria-label="t('预览方式', 'Preview mode')"
                :options="[
                  { value: 'compare', label: t('并排对比', 'Side by side') },
                  { value: 'original', label: t('仅原图', 'Original only') },
                  { value: 'result', label: t('仅结果', 'Result only') },
                ]"
              />
            </div>
            <div
              class="image-preview-grid"
              :class="{ single: preview !== 'compare' }"
            >
              <figure v-if="preview !== 'result'">
                <figcaption>
                  {{ t("原图", "Original") }} ·
                  {{ formatBytes(current.file.size)
                  }}<template v-if="current.result">
                    · {{ current.result.originalWidth }} ×
                    {{ current.result.originalHeight }}</template
                  >
                </figcaption>
                <div class="image-checker">
                  <img
                    :src="current.sourceUrl"
                    :alt="t('原始图片预览', 'Original image preview')"
                  />
                </div>
              </figure>
              <figure v-if="preview !== 'original'">
                <figcaption>
                  {{ t("处理结果", "Result")
                  }}<template v-if="current.result">
                    · {{ formatBytes(current.result.blob.size) }} ·
                    {{ current.result.width }} ×
                    {{ current.result.height }}</template
                  >
                </figcaption>
                <div class="image-checker">
                  <img
                    v-if="current.resultUrl"
                    :src="current.resultUrl"
                    :alt="t('处理结果预览', 'Processed image preview')"
                  /><span v-else>{{
                    current.error
                      ? errorText(current.error)
                      : t("处理后在这里查看", "Your result will appear here")
                  }}</span>
                </div>
              </figure>
            </div>
            <div v-if="current.result" class="image-result-actions">
              <p
                :class="{
                  'image-warning':
                    current.result.blob.size >= current.file.size,
                }"
              >
                {{
                  current.result.blob.size >= current.file.size
                    ? t(
                        "体积未减小：原图可能已充分压缩。可降低质量、改用 WebP，或保留原图。",
                        "No size reduction: the original may already be optimized. Try lower quality, WebP, or keep the original.",
                      )
                    : t("已缩小", "Reduced by") +
                      " " +
                      Math.round(
                        (1 - current.result.blob.size / current.file.size) *
                          100,
                      ) +
                      "%"
                }}
              </p>
              <button class="button" @click="download(current, true)">
                {{ t("下载原图", "Save original") }}</button
              ><button class="button primary" @click="download(current)">
                <Download :size="16" />{{ t("下载结果", "Save result") }}
              </button>
            </div>
          </div>
        </section>
      </section>
      <aside class="panel image-settings">
        <div class="panel-heading">
          <h2>
            <SlidersHorizontal :size="18" />{{
              t("处理设置", "Processing settings")
            }}
          </h2>
        </div>
        <fieldset :disabled="locked">
          <label
            >{{ t("输出格式", "Output format")
            }}<AppSelect
              v-model="options.format"
              :disabled="locked"
              :aria-label="t('输出图片格式', 'Output image format')"
              :options="[
                {
                  value: 'original',
                  label: t(
                    '保持格式（BMP / GIF 转 PNG）',
                    'Keep format (BMP / GIF → PNG)',
                  ),
                },
                { value: 'image/webp', label: 'WebP' },
                { value: 'image/jpeg', label: 'JPG / JPEG' },
                { value: 'image/png', label: 'PNG' },
              ]"
          /></label>
          <p class="image-help">
            {{
              t(
                "WebP / JPG 支持有损压缩；PNG 保留透明，质量滑块对 PNG 不生效。",
                "WebP / JPG use lossy compression. PNG supports transparency; its quality is not controlled by the slider.",
              )
            }}
          </p>
          <label class="image-quality-label" for="image-quality"
            >{{ t("画质优先", "Quality first")
            }}<strong>{{ Math.round(options.quality * 100) }}%</strong></label
          >
          <input
            id="image-quality"
            v-model.number="options.quality"
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            :disabled="options.format === 'image/png'"
          />
          <div class="image-range-labels">
            <span>{{ t("更小体积", "Smaller file") }}</span
            ><span>{{ t("更多细节", "More detail") }}</span>
          </div>
          <label class="checkbox-label"
            ><input
              v-model="resized"
              type="checkbox"
              @change="resizeToggle"
            />{{
              t("限制最长边（等比缩小）", "Limit longest edge (proportional)")
            }}</label
          >
          <label v-if="resized"
            >{{ t("最长边 / 像素", "Longest edge / pixels")
            }}<input
              v-model.number="options.maxEdge"
              type="number"
              min="1"
              max="12000"
              step="1"
          /></label>
          <p v-else class="image-help">
            {{
              t(
                "默认保留原始分辨率，不放大图片。",
                "Original resolution by default. Images are never enlarged.",
              )
            }}
          </p>
          <label v-if="options.format === 'image/jpeg'"
            >{{ t("透明区域填充色", "Transparency background")
            }}<AppSelect
              v-model="options.background"
              :disabled="locked"
              :aria-label="t('透明区域填充色', 'Transparency background')"
              :options="[
                { value: '#ffffff', label: t('白色', 'White') },
                { value: '#000000', label: t('黑色', 'Black') },
              ]"
          /></label>
          <div class="image-notice">
            <ShieldCheck :size="18" />
            <p>
              {{
                t(
                  "导出仅支持静态图片；动画只取单帧。重新编码不保留 EXIF 等原始元数据，颜色可能略有差异。原图不会被修改。",
                  "Exports are static; animations become a single frame. Re-encoding drops original metadata such as EXIF and may shift colors slightly. Originals are not modified.",
                )
              }}
            </p>
          </div>
          <label class="checkbox-label image-ack"
            ><input v-model="acknowledged" type="checkbox" />{{
              t(
                "我了解静态导出与元数据变化",
                "I understand static export and metadata changes",
              )
            }}</label
          >
        </fieldset>
        <div class="image-process-actions">
          <button
            class="button primary"
            :disabled="
              locked ||
              !items.length ||
              !acknowledged ||
              (resized && !(options.maxEdge >= 1 && options.maxEdge <= 12000))
            "
            @click="run"
          >
            <Images :size="17" />{{
              busy
                ? t("正在处理…", "Processing…")
                : t("处理全部图片", "Process all images")
            }}</button
          ><button
            v-if="busy"
            class="button"
            :disabled="cancelled"
            @click="cancelled = true"
          >
            {{
              cancelled
                ? t("正在停止…", "Stopping…")
                : t("停止后续处理", "Stop remaining")
            }}
          </button>
        </div>
        <div v-if="completed.length" class="image-summary" aria-live="polite">
          <span
            >{{ t("已完成", "Completed") }} {{ completed.length }} /
            {{ items.length }}</span
          ><strong
            >{{ formatBytes(totals.before) }} <ArrowRight :size="16" />
            {{ formatBytes(totals.after) }}</strong
          ><small>{{
            savings > 0
              ? t("体积减少", "Size reduction") + " " + savings + "%"
              : t("格式转换完成，体积未减小", "Converted; no size reduction")
          }}</small>
        </div>
        <p class="image-help image-session-note">
          {{
            t(
              "切换功能可保留本次图片；关闭应用或刷新页面后清空。更改参数后需重新处理。",
              "Images stay while switching tools, not after refresh or exit. Reprocess after changing settings.",
            )
          }}
        </p>
      </aside>
    </div>
  </div>
</template>
<style src="../images.css"></style>
