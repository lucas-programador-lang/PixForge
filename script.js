/* =========================================================
   PixForge — script.js
   Todas as ferramentas rodam 100% no navegador via Canvas API.

   Índice:
   1. Utilidades gerais (imagem, blob, download, bytes)
   2. Dropzone genérica (compartilhada por todas as ferramentas)
   3. Ferramentas 01–07 (uma IIFE por ferramenta, isoladas)
   4. Navegação — menu mobile + scrollspy
   5. Hero — partículas de faísca em canvas
   ========================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------
     Utilidades gerais
     --------------------------------------------------------- */
  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  function loadImageFromDataURL(dataURL) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataURL;
    });
  }

  function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return "—";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function extForMime(mime) {
    if (mime === "image/png") return "png";
    if (mime === "image/webp") return "webp";
    return "jpg";
  }

  // Gera um blob a partir de uma imagem/canvas fonte, sempre em resolução real.
  // Para JPEG, compõe sobre fundo branco (JPEG não tem canal alfa).
  function toExportBlob(source, mime, quality) {
    return new Promise((resolve) => {
      const w = source.naturalWidth || source.width;
      const h = source.naturalHeight || source.height;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (mime === "image/jpeg") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(source, 0, 0, w, h);
      c.toBlob((blob) => resolve(blob), mime, quality);
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function downloadCanvasPNG(canvas, filename) {
    canvas.toBlob((blob) => downloadBlob(blob, filename), "image/png");
  }

  // Cria uma <img> a partir do conteúdo atual de um canvas (para "assar"
  // uma transformação como nova imagem-base, permitindo encadear ações).
  function commitCanvasAsImage(canvas) {
    return loadImageFromDataURL(canvas.toDataURL("image/png"));
  }

  /* ---------------------------------------------------------
     Dropzone genérica — compartilhada por todas as ferramentas
     --------------------------------------------------------- */
  function setupDropzone(panel, onImageLoaded) {
    const dropzone = panel.querySelector('[data-role="dropzone"]');
    const fileInput = panel.querySelector('[data-role="fileInput"]');
    const empty = panel.querySelector('[data-role="empty"]');
    const canvas = panel.querySelector('[data-role="canvas"]');
    const controls = panel.querySelector('[data-role="controls"]');
    const cropStage = panel.querySelector('[data-role="cropStage"]');

    function reveal() {
      empty.hidden = true;
      if (cropStage) cropStage.hidden = false;
      else canvas.hidden = false;
      controls.hidden = false;
    }

    function handleFile(file) {
      if (!file || !file.type || !file.type.startsWith("image/")) return;
      loadImageFromFile(file).then((img) => {
        reveal();
        onImageLoaded(img, file);
      });
    }

    empty.addEventListener("click", () => fileInput.click());
    empty.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") fileInput.click();
    });
    fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

    ["dragenter", "dragover"].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add("is-dragover");
      })
    );
    ["dragleave", "drop"].forEach((evt) =>
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove("is-dragover");
      })
    );
    dropzone.addEventListener("drop", (e) => {
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      handleFile(file);
    });

    const resetBtn = panel.querySelector('[data-action="reset"]');
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        empty.hidden = false;
        if (cropStage) cropStage.hidden = true;
        else canvas.hidden = true;
        controls.hidden = true;
        fileInput.value = "";
      });
    }

    return { dropzone, fileInput, empty, canvas, controls, cropStage };
  }

  function drawFullRes(canvas, img) {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return ctx;
  }

  /* ===========================================================
     01 — REDIMENSIONAR
     =========================================================== */
  (function initResize() {
    const panel = document.querySelector('[data-tool="resize"]');
    if (!panel) return;
    const els = setupDropzone(panel, onLoad);
    const widthInput = panel.querySelector('[data-role="width"]');
    const heightInput = panel.querySelector('[data-role="height"]');
    const lockRatio = panel.querySelector('[data-role="lockRatio"]');
    const readout = panel.querySelector('[data-role="readout"]');
    const presets = panel.querySelectorAll("[data-w]");

    let workingImg = null;
    let ratio = 1;

    function onLoad(img) {
      workingImg = img;
      ratio = img.naturalWidth / img.naturalHeight;
      drawFullRes(els.canvas, img);
      widthInput.value = img.naturalWidth;
      heightInput.value = img.naturalHeight;
      updateReadout();
    }

    function updateReadout() {
      readout.textContent = `Dimensão atual: ${els.canvas.width} × ${els.canvas.height}px`;
    }

    widthInput.addEventListener("input", () => {
      if (lockRatio.checked && widthInput.value) {
        heightInput.value = Math.round(widthInput.value / ratio);
      }
    });
    heightInput.addEventListener("input", () => {
      if (lockRatio.checked && heightInput.value) {
        widthInput.value = Math.round(heightInput.value * ratio);
      }
    });

    presets.forEach((btn) => {
      btn.addEventListener("click", () => {
        widthInput.value = btn.dataset.w;
        heightInput.value = lockRatio.checked
          ? Math.round(btn.dataset.w / ratio)
          : btn.dataset.h;
      });
    });

    panel.querySelector('[data-action="apply"]').addEventListener("click", () => {
      if (!workingImg) return;
      const w = Math.max(1, parseInt(widthInput.value, 10) || workingImg.naturalWidth);
      const h = Math.max(1, parseInt(heightInput.value, 10) || workingImg.naturalHeight);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(workingImg, 0, 0, w, h);
      els.canvas.width = w;
      els.canvas.height = h;
      els.canvas.getContext("2d").drawImage(c, 0, 0);
      updateReadout();
    });

    panel.querySelector('[data-action="download"]').addEventListener("click", () => {
      downloadCanvasPNG(els.canvas, "pixforge-redimensionado.png");
    });
  })();

  /* ===========================================================
     02 — CORTAR
     =========================================================== */
  (function initCrop() {
    const panel = document.querySelector('[data-tool="crop"]');
    if (!panel) return;
    const els = setupDropzone(panel, onLoad);
    const cropBox = panel.querySelector('[data-role="cropBox"]');
    const readout = panel.querySelector('[data-role="readout"]');
    const ratioChips = panel.querySelectorAll("[data-ratio]");

    let workingImg = null;
    let box = { x: 0, y: 0, w: 0, h: 0 };
    let lockedRatio = null; // number or null (livre)
    let dragMode = null; // 'move' | handle name
    let dragStart = null;

    function onLoad(img) {
      workingImg = img;
      drawFullRes(els.canvas, img);
      // caixa inicial: 70% centralizada, em coordenadas renderizadas (CSS px)
      requestAnimationFrame(() => {
        const rect = els.canvas.getBoundingClientRect();
        const w = rect.width * 0.7;
        const h = rect.height * 0.7;
        box = { x: (rect.width - w) / 2, y: (rect.height - h) / 2, w, h };
        paintBox();
      });
    }

    function stageRect() {
      return els.canvas.getBoundingClientRect();
    }

    function clampBox() {
      const rect = stageRect();
      box.w = Math.max(20, Math.min(box.w, rect.width));
      box.h = Math.max(20, Math.min(box.h, rect.height));
      box.x = Math.max(0, Math.min(box.x, rect.width - box.w));
      box.y = Math.max(0, Math.min(box.y, rect.height - box.h));
    }

    function paintBox() {
      clampBox();
      cropBox.style.left = box.x + "px";
      cropBox.style.top = box.y + "px";
      cropBox.style.width = box.w + "px";
      cropBox.style.height = box.h + "px";
      const rect = stageRect();
      const scaleX = els.canvas.width / rect.width;
      const scaleY = els.canvas.height / rect.height;
      readout.textContent = `Área selecionada: ${Math.round(box.w * scaleX)} × ${Math.round(box.h * scaleY)}px`;
    }

    cropBox.addEventListener("pointerdown", (e) => {
      const handle = e.target.dataset.handle;
      dragMode = handle || "move";
      dragStart = { x: e.clientX, y: e.clientY, box: { ...box } };
      cropBox.setPointerCapture(e.pointerId);
    });

    cropBox.addEventListener("pointermove", (e) => {
      if (!dragMode) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const start = dragStart.box;

      if (dragMode === "move") {
        box.x = start.x + dx;
        box.y = start.y + dy;
      } else {
        let { x, y, w, h } = start;
        if (dragMode.includes("e")) w = start.w + dx;
        if (dragMode.includes("w")) {
          w = start.w - dx;
          x = start.x + dx;
        }
        if (dragMode.includes("s")) h = start.h + dy;
        if (dragMode.includes("n")) {
          h = start.h - dy;
          y = start.y + dy;
        }
        if (lockedRatio) h = w / lockedRatio;
        box = { x, y, w: Math.max(20, w), h: Math.max(20, h) };
      }
      paintBox();
    });

    cropBox.addEventListener("pointerup", (e) => {
      dragMode = null;
      cropBox.releasePointerCapture(e.pointerId);
    });

    ratioChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        ratioChips.forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        const val = chip.dataset.ratio;
        if (val === "free") {
          lockedRatio = null;
        } else {
          const [a, b] = val.split(":").map(Number);
          lockedRatio = a / b;
          box.h = box.w / lockedRatio;
          paintBox();
        }
      });
    });

    window.addEventListener("resize", () => {
      if (workingImg) paintBox();
    });

    panel.querySelector('[data-action="apply"]').addEventListener("click", () => {
      if (!workingImg) return;
      const rect = stageRect();
      const scaleX = els.canvas.width / rect.width;
      const scaleY = els.canvas.height / rect.height;
      const sx = box.x * scaleX;
      const sy = box.y * scaleY;
      const sw = box.w * scaleX;
      const sh = box.h * scaleY;

      const out = document.createElement("canvas");
      out.width = Math.round(sw);
      out.height = Math.round(sh);
      out.getContext("2d").drawImage(els.canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);

      commitCanvasAsImage(out).then((newImg) => {
        workingImg = newImg;
        drawFullRes(els.canvas, newImg);
        requestAnimationFrame(() => {
          const r = stageRect();
          box = { x: r.width * 0.1, y: r.height * 0.1, w: r.width * 0.8, h: r.height * 0.8 };
          paintBox();
        });
      });
    });

    panel.querySelector('[data-action="download"]').addEventListener("click", () => {
      downloadCanvasPNG(els.canvas, "pixforge-cortado.png");
    });
  })();

  /* ===========================================================
     03 — GIRAR
     =========================================================== */
  (function initRotate() {
    const panel = document.querySelector('[data-tool="rotate"]');
    if (!panel) return;
    const els = setupDropzone(panel, onLoad);
    const angleInput = panel.querySelector('[data-role="angle"]');
    const angleLabel = panel.querySelector('[data-role="angleLabel"]');

    let workingImg = null;
    let base90 = 0; // múltiplos de 90 já confirmados
    let flipped = false;

    function onLoad(img) {
      workingImg = img;
      base90 = 0;
      flipped = false;
      angleInput.value = 0;
      angleLabel.textContent = "0°";
      render(0);
    }

    function render(fineAngle) {
      const totalDeg = base90 + fineAngle;
      const rad = (totalDeg * Math.PI) / 180;
      const iw = workingImg.naturalWidth;
      const ih = workingImg.naturalHeight;

      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const outW = Math.ceil(iw * cos + ih * sin);
      const outH = Math.ceil(iw * sin + ih * cos);

      els.canvas.width = outW;
      els.canvas.height = outH;
      const ctx = els.canvas.getContext("2d");
      ctx.clearRect(0, 0, outW, outH);
      ctx.save();
      ctx.translate(outW / 2, outH / 2);
      ctx.rotate(rad);
      ctx.scale(flipped ? -1 : 1, 1);
      ctx.drawImage(workingImg, -iw / 2, -ih / 2);
      ctx.restore();
    }

    angleInput.addEventListener("input", () => {
      angleLabel.textContent = `${angleInput.value}°`;
      render(Number(angleInput.value));
    });

    panel.querySelector('[data-action="rotate90cw"]').addEventListener("click", () => {
      base90 += 90;
      angleInput.value = 0;
      angleLabel.textContent = "0°";
      render(0);
    });
    panel.querySelector('[data-action="rotate90ccw"]').addEventListener("click", () => {
      base90 -= 90;
      angleInput.value = 0;
      angleLabel.textContent = "0°";
      render(0);
    });
    panel.querySelector('[data-action="flipH"]').addEventListener("click", () => {
      flipped = !flipped;
      render(Number(angleInput.value));
    });

    panel.querySelector('[data-action="apply"]').addEventListener("click", () => {
      if (!workingImg) return;
      commitCanvasAsImage(els.canvas).then((newImg) => {
        workingImg = newImg;
        base90 = 0;
        flipped = false;
        angleInput.value = 0;
        angleLabel.textContent = "0°";
        drawFullRes(els.canvas, newImg);
      });
    });

    panel.querySelector('[data-action="download"]').addEventListener("click", () => {
      downloadCanvasPNG(els.canvas, "pixforge-girado.png");
    });
  })();

  /* ===========================================================
     04 — COMPRIMIR
     =========================================================== */
  (function initCompress() {
    const panel = document.querySelector('[data-tool="compress"]');
    if (!panel) return;
    const els = setupDropzone(panel, onLoad);
    const formatSelect = panel.querySelector('[data-role="format"]');
    const qualityInput = panel.querySelector('[data-role="quality"]');
    const qualityLabel = panel.querySelector('[data-role="qualityLabel"]');
    const sizeBefore = panel.querySelector('[data-role="sizeBefore"]');
    const sizeAfter = panel.querySelector('[data-role="sizeAfter"]');
    const sizeSaved = panel.querySelector('[data-role="sizeSaved"]');
    const pngHint = panel.querySelector('[data-role="pngHint"]');

    let workingImg = null;
    let originalSize = 0;
    let lastBlob = null;

    function onLoad(img, file) {
      workingImg = img;
      originalSize = file.size;
      drawFullRes(els.canvas, img);
      sizeBefore.textContent = formatBytes(originalSize);
      sizeAfter.textContent = "—";
      sizeSaved.textContent = "—";

      const isPng = file.type === "image/png";
      pngHint.hidden = !isPng;
      if (isPng) formatSelect.value = "image/webp";

      recompute();
    }

    function recompute() {
      if (!workingImg) return;
      const mime = formatSelect.value;
      const quality = Number(qualityInput.value) / 100;
      toExportBlob(workingImg, mime, quality).then((blob) => {
        lastBlob = blob;
        sizeAfter.textContent = formatBytes(blob.size);
        const diff = originalSize - blob.size;
        const pct = originalSize ? Math.round((diff / originalSize) * 100) : 0;
        sizeSaved.textContent = (pct >= 0 ? "-" : "+") + Math.abs(pct) + "%";
      });
    }

    qualityInput.addEventListener("input", () => {
      qualityLabel.textContent = `${qualityInput.value}%`;
      recompute();
    });
    formatSelect.addEventListener("change", recompute);
    panel.querySelector('[data-action="apply"]').addEventListener("click", recompute);

    panel.querySelector('[data-action="download"]').addEventListener("click", () => {
      if (!lastBlob) return;
      downloadBlob(lastBlob, `pixforge-comprimido.${extForMime(formatSelect.value)}`);
    });
  })();

  /* ===========================================================
     05 — CONVERTER FORMATO
     =========================================================== */
  (function initConvert() {
    const panel = document.querySelector('[data-tool="convert"]');
    if (!panel) return;
    const els = setupDropzone(panel, onLoad);
    const readout = panel.querySelector('[data-role="readout"]');
    const formatSelect = panel.querySelector('[data-role="format"]');
    const qualityWrap = panel.querySelector('[data-role="qualityWrap"]');
    const qualityInput = panel.querySelector('[data-role="quality"]');
    const qualityLabel = panel.querySelector('[data-role="qualityLabel"]');

    let workingImg = null;
    let lastBlob = null;

    function onLoad(img, file) {
      workingImg = img;
      drawFullRes(els.canvas, img);
      readout.textContent = `Formato original: ${file.type || "desconhecido"}`;
      toggleQuality();
      recompute();
    }

    function toggleQuality() {
      qualityWrap.hidden = formatSelect.value === "image/png";
    }

    function recompute() {
      if (!workingImg) return;
      const mime = formatSelect.value;
      const quality = Number(qualityInput.value) / 100;
      toExportBlob(workingImg, mime, quality).then((blob) => {
        lastBlob = blob;
      });
    }

    formatSelect.addEventListener("change", () => {
      toggleQuality();
      recompute();
    });
    qualityInput.addEventListener("input", () => {
      qualityLabel.textContent = `${qualityInput.value}%`;
      recompute();
    });
    panel.querySelector('[data-action="apply"]').addEventListener("click", recompute);

    panel.querySelector('[data-action="download"]').addEventListener("click", () => {
      if (!lastBlob) return;
      downloadBlob(lastBlob, `pixforge-convertido.${extForMime(formatSelect.value)}`);
    });
  })();

  /* ===========================================================
     06 — MARCA D'ÁGUA
     =========================================================== */
  (function initWatermark() {
    const panel = document.querySelector('[data-tool="watermark"]');
    if (!panel) return;
    const els = setupDropzone(panel, onLoad);
    const textInput = panel.querySelector('[data-role="text"]');
    const sizeInput = panel.querySelector('[data-role="size"]');
    const sizeLabel = panel.querySelector('[data-role="sizeLabel"]');
    const colorInput = panel.querySelector('[data-role="color"]');
    const opacityInput = panel.querySelector('[data-role="opacity"]');
    const opacityLabel = panel.querySelector('[data-role="opacityLabel"]');
    const posButtons = panel.querySelectorAll("[data-pos]");

    let workingImg = null;
    let position = "center";

    function onLoad(img) {
      workingImg = img;
      drawFullRes(els.canvas, img);
      render();
    }

    function positionXY(w, h, textW, fontSize) {
      const margin = Math.max(16, fontSize * 0.5);
      const map = {
        "top-left": [margin, margin, "left", "top"],
        "top-center": [w / 2, margin, "center", "top"],
        "top-right": [w - margin, margin, "right", "top"],
        "middle-left": [margin, h / 2, "left", "middle"],
        center: [w / 2, h / 2, "center", "middle"],
        "middle-right": [w - margin, h / 2, "right", "middle"],
        "bottom-left": [margin, h - margin, "left", "bottom"],
        "bottom-center": [w / 2, h - margin, "center", "bottom"],
        "bottom-right": [w - margin, h - margin, "right", "bottom"],
      };
      return map[position];
    }

    function render() {
      if (!workingImg) return;
      const ctx = drawFullRes(els.canvas, workingImg);
      const w = els.canvas.width;
      const h = els.canvas.height;
      const fontSize = Number(sizeInput.value);
      const opacity = Number(opacityInput.value) / 100;
      const text = textInput.value || "";

      ctx.font = `700 ${fontSize}px 'Sora', sans-serif`;
      const [x, y, align, baseline] = positionXY(w, h, 0, fontSize);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = colorInput.value;
      ctx.textAlign = align;
      ctx.textBaseline = baseline;
      ctx.fillText(text, x, y);
      ctx.globalAlpha = 1;
    }

    [textInput, sizeInput, colorInput, opacityInput].forEach((el) =>
      el.addEventListener("input", () => {
        sizeLabel.textContent = `${sizeInput.value}px`;
        opacityLabel.textContent = `${opacityInput.value}%`;
        render();
      })
    );

    posButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        posButtons.forEach((b) => b.classList.remove("grid9__dot--active"));
        btn.classList.add("grid9__dot--active");
        position = btn.dataset.pos;
        render();
      });
    });

    panel.querySelector('[data-action="apply"]').addEventListener("click", render);
    panel.querySelector('[data-action="download"]').addEventListener("click", () => {
      downloadCanvasPNG(els.canvas, "pixforge-marca-dagua.png");
    });
  })();

  /* ===========================================================
     07 — CANTOS ARREDONDADOS
     =========================================================== */
  (function initRoundCorners() {
    const panel = document.querySelector('[data-tool="roundcorners"]');
    if (!panel) return;
    const els = setupDropzone(panel, onLoad);
    const radiusInput = panel.querySelector('[data-role="radius"]');
    const radiusLabel = panel.querySelector('[data-role="radiusLabel"]');

    let workingImg = null;

    function onLoad(img) {
      workingImg = img;
      els.canvas.width = img.naturalWidth;
      els.canvas.height = img.naturalHeight;
      render();
    }

    function render() {
      if (!workingImg) return;
      const w = els.canvas.width;
      const h = els.canvas.height;
      const maxRadius = Math.min(w, h) / 2;
      const r = Math.min(Number(radiusInput.value), maxRadius);
      const ctx = els.canvas.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.arcTo(w, 0, w, h, r);
      ctx.arcTo(w, h, 0, h, r);
      ctx.arcTo(0, h, 0, 0, r);
      ctx.arcTo(0, 0, w, 0, r);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(workingImg, 0, 0, w, h);
      ctx.restore();
    }

    radiusInput.addEventListener("input", () => {
      radiusLabel.textContent = `${radiusInput.value}px`;
      render();
    });

    panel.querySelector('[data-action="apply"]').addEventListener("click", render);
    panel.querySelector('[data-action="download"]').addEventListener("click", () => {
      downloadCanvasPNG(els.canvas, "pixforge-cantos-arredondados.png");
    });
  })();

  /* ===========================================================
     Navegação — menu mobile + scrollspy
     =========================================================== */
  (function initNav() {
    const toggle = document.getElementById("navToggle");
    const links = document.getElementById("navLinks");
    if (!toggle || !links) return;

    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      toggle.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });

    const navAnchors = Array.from(links.querySelectorAll("a"));
    navAnchors.forEach((a) => {
      a.addEventListener("click", () => {
        links.classList.remove("is-open");
        toggle.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });

    const sections = navAnchors
      .map((a) => document.querySelector(a.getAttribute("href")))
      .filter(Boolean);

    if ("IntersectionObserver" in window && sections.length) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const id = "#" + entry.target.id;
            navAnchors.forEach((a) =>
              a.classList.toggle("is-active", a.getAttribute("href") === id)
            );
          });
        },
        { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
      );
      sections.forEach((s) => observer.observe(s));
    }
  })();

  /* ===========================================================
     Hero — partículas de faísca (canvas de fundo)
     =========================================================== */
  (function initSparks() {
    const canvas = document.getElementById("sparkCanvas");
    if (!canvas) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    let particles = [];
    let w, h, dpr;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn() {
      const colors = ["#C9793D", "#E8B563", "#F3DDA8"];
      return {
        x: Math.random() * w,
        y: h + 10,
        r: 1 + Math.random() * 2.2,
        speed: 0.35 + Math.random() * 0.9,
        drift: (Math.random() - 0.5) * 0.6,
        life: 0,
        maxLife: 260 + Math.random() * 220,
        color: colors[(Math.random() * colors.length) | 0],
      };
    }

    resize();
    window.addEventListener("resize", resize);
    const count = window.innerWidth < 700 ? 26 : 48;
    for (let i = 0; i < count; i++) {
      const p = spawn();
      p.y = Math.random() * h;
      particles.push(p);
    }

    if (reduceMotion) {
      // Render um frame estático, sem loop de animação.
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      return;
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.life++;
        p.y -= p.speed;
        p.x += p.drift;
        const lifeRatio = p.life / p.maxLife;
        const alpha = lifeRatio < 0.15 ? lifeRatio / 0.15 : 1 - Math.max(0, (lifeRatio - 0.6) / 0.4);
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.75;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        if (p.life > p.maxLife || p.y < -10) Object.assign(p, spawn());
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();
})();
