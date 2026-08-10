const state = {
  mainImage: null,
  annotation: null,
  faceRefs: [],
  styleRefs: [],
  primaryFace: null,
  generatedPrompt: "",
};

const $ = (selector) => document.querySelector(selector);
const canvas = $("#annotationCanvas");
const ctx = canvas.getContext("2d");
const canvasStage = $("#canvasStage");
const emptyCanvasMessage = $("#emptyCanvasMessage");
const clearAnnotationButton = $("#clearAnnotationButton");
const generateButton = $("#generateButton");
const exportButton = $("#exportButton");
const copyButton = $("#copyButton");
const promptOutput = $("#promptOutput");
const outputMeta = $("#outputMeta");
const toast = $("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, src: reader.result });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fitCanvas(image) {
  const maxWidth = Math.max(320, canvasStage.clientWidth);
  const maxHeight = 540;
  const ratio = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
  canvas.width = Math.round(image.naturalWidth * ratio);
  canvas.height = Math.round(image.naturalHeight * ratio);
  canvasStage.classList.remove("empty");
  emptyCanvasMessage.hidden = true;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  drawAnnotation();
}

function drawAnnotation() {
  if (!state.mainImage) return;
  const image = new Image();
  image.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const ratio = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    ctx.drawImage(image, 0, 0, image.naturalWidth * ratio, image.naturalHeight * ratio);
    if (!state.annotation) return;
    const a = state.annotation;
    ctx.beginPath();
    ctx.ellipse(a.cx * canvas.width, a.cy * canvas.height, a.rx * canvas.width, a.ry * canvas.height, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = Math.max(3, canvas.width / 170);
    ctx.shadowColor = "rgba(255,255,255,.8)";
    ctx.shadowBlur = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
  };
  image.src = state.mainImage.src;
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
}

let dragStart = null;
canvas.addEventListener("pointerdown", (event) => {
  if (!state.mainImage) return;
  canvas.setPointerCapture(event.pointerId);
  dragStart = canvasPoint(event);
});
canvas.addEventListener("pointerup", (event) => {
  if (!dragStart || !state.mainImage) return;
  const end = canvasPoint(event);
  const cx = (dragStart.x + end.x) / 2;
  const cy = (dragStart.y + end.y) / 2;
  state.annotation = { cx, cy, rx: Math.max(.025, Math.abs(end.x - dragStart.x) / 2), ry: Math.max(.025, Math.abs(end.y - dragStart.y) / 2) };
  dragStart = null;
  clearAnnotationButton.disabled = false;
  drawAnnotation();
  showToast("红圈已更新");
});
canvas.addEventListener("pointermove", (event) => {
  if (!dragStart || !state.mainImage) return;
  const end = canvasPoint(event);
  const draft = { cx: (dragStart.x + end.x) / 2, cy: (dragStart.y + end.y) / 2, rx: Math.max(.025, Math.abs(end.x - dragStart.x) / 2), ry: Math.max(.025, Math.abs(end.y - dragStart.y) / 2) };
  const previous = state.annotation;
  state.annotation = draft;
  drawAnnotation();
  state.annotation = previous;
});

async function setMainImage(file) {
  if (!file) return;
  state.mainImage = await readImage(file);
  state.annotation = null;
  clearAnnotationButton.disabled = true;
  const image = new Image();
  image.onload = () => fitCanvas(image);
  image.src = state.mainImage.src;
  showToast("主图已载入");
}

function renderReferences(kind) {
  const target = kind === "face" ? $("#faceReferences") : $("#styleReferences");
  const refs = kind === "face" ? state.faceRefs : state.styleRefs;
  target.innerHTML = "";
  refs.forEach((ref, index) => {
    const card = document.createElement("div");
    card.className = "reference-card";
    card.innerHTML = `<img src="${ref.src}" alt="${ref.name}" /><button class="remove-ref" title="移除">×</button>${kind === "face" ? `<button class="primary-ref ${state.primaryFace === index ? "active" : ""}" title="设为主参考">★</button>` : ""}`;
    card.querySelector(".remove-ref").addEventListener("click", () => {
      refs.splice(index, 1);
      if (kind === "face" && state.primaryFace >= refs.length) state.primaryFace = refs.length ? 0 : null;
      renderReferences(kind);
    });
    const primary = card.querySelector(".primary-ref");
    if (primary) primary.addEventListener("click", () => { state.primaryFace = index; renderReferences("face"); });
    target.appendChild(card);
  });
  const placeholder = document.createElement("div");
  placeholder.className = "reference-card placeholder";
  placeholder.textContent = "+";
  target.appendChild(placeholder);
}

async function addReferences(kind, files) {
  const refs = await Promise.all([...files].map(readImage));
  (kind === "face" ? state.faceRefs : state.styleRefs).push(...refs);
  if (kind === "face" && state.primaryFace === null && state.faceRefs.length) state.primaryFace = 0;
  renderReferences(kind);
  showToast(`已添加 ${refs.length} 张参考图`);
}

document.addEventListener("click", (event) => {
  const button = event.target.closest(".add-reference");
  if (!button) return;
  document.querySelector(`[data-input="${button.dataset.target}"]`).click();
});

$("#chooseMainButton").addEventListener("click", () => $("#mainImageInput").click());
$("#mainUploadZone").addEventListener("click", (event) => {
  if (!event.target.closest("button")) $("#mainImageInput").click();
});
$("#mainImageInput").addEventListener("change", (event) => setMainImage(event.target.files[0]));
document.querySelectorAll("[data-input]").forEach((input) => {
  input.addEventListener("change", (event) => addReferences(input.dataset.input, event.target.files));
});
clearAnnotationButton.addEventListener("click", () => {
  state.annotation = null;
  clearAnnotationButton.disabled = true;
  drawAnnotation();
  showToast("标注已清除");
});

function makePrompt() {
  const desc = $("#descriptionInput").value.trim() || "自然地优化主体面部细节，保持整体画面真实、协调。";
  const style = $("#styleInput").value;
  const ratio = $("#ratioInput").value;
  const preserve = $("#preserveInput").checked;
  const annotationText = state.annotation ? "红圈区域是唯一需要重点修改的区域，请精确处理，不要扩散到其他部分。" : "请先根据主图判断需要编辑的主体区域。";
  const faceText = state.faceRefs.length ? `脸部参考：${state.faceRefs.length} 张${state.primaryFace !== null ? "，第一张为主参考" : ""}。` : "没有额外脸部参考。";
  const styleText = state.styleRefs.length ? `服装与配饰参考：${state.styleRefs.length} 张，用于匹配材质、色彩与细节。` : "没有额外服装或配饰参考。";
  return [
    "【Image 2.0 编辑指令】",
    `目标：${desc}`,
    `风格：${style}。画幅：${ratio}。`,
    annotationText,
    preserve ? "锁定未标注区域：保持原图构图、姿态、背景、镜头视角与光线关系不变。" : "允许对整体画面做小幅协调调整，但不要改变主体身份与构图。",
    faceText,
    styleText,
    "输出要求：自然融合边缘与肤色，保留真实纹理，避免额外人物、文字、水印、畸形五官和过度磨皮。"
  ].join("\n");
}

generateButton.addEventListener("click", () => {
  state.generatedPrompt = makePrompt();
  promptOutput.textContent = state.generatedPrompt;
  outputMeta.textContent = `已生成 · ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  copyButton.disabled = false;
  exportButton.disabled = false;
  showToast("提示词已生成");
});

copyButton.addEventListener("click", async () => {
  if (!state.generatedPrompt) return;
  await navigator.clipboard.writeText(state.generatedPrompt);
  showToast("提示词已复制");
});

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

exportButton.addEventListener("click", () => {
  const project = {
    app: "Aaron & Shark Browser",
    createdAt: new Date().toISOString(),
    mainImage: state.mainImage?.name || null,
    annotation: state.annotation,
    faceReferences: state.faceRefs.map((ref) => ref.name),
    styleReferences: state.styleRefs.map((ref) => ref.name),
    prompt: state.generatedPrompt || makePrompt(),
  };
  download("aaron-shark-project.json", JSON.stringify(project, null, 2), "application/json");
  showToast("项目 JSON 已导出");
});

$("#resetButton").addEventListener("click", () => {
  if (!confirm("确定要清空当前项目吗？")) return;
  state.mainImage = null;
  state.annotation = null;
  state.faceRefs = [];
  state.styleRefs = [];
  state.primaryFace = null;
  state.generatedPrompt = "";
  canvas.width = 0;
  canvas.height = 0;
  canvasStage.classList.add("empty");
  emptyCanvasMessage.hidden = false;
  clearAnnotationButton.disabled = true;
  copyButton.disabled = true;
  exportButton.disabled = true;
  promptOutput.innerHTML = '<div class="output-placeholder"><span class="output-mark">✦</span><p>完成左侧标注后，点击“生成提示词”。</p></div>';
  outputMeta.textContent = "等待生成";
  $("#mainImageInput").value = "";
  document.querySelectorAll("[data-input]").forEach((input) => { input.value = ""; });
  renderReferences("face");
  renderReferences("style");
  showToast("项目已清空");
});

window.addEventListener("resize", () => {
  if (!state.mainImage) return;
  const image = new Image();
  image.onload = () => fitCanvas(image);
  image.src = state.mainImage.src;
});

renderReferences("face");
renderReferences("style");
