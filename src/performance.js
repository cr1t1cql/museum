export function createPerformanceMonitor(renderer) {
    const panel = document.createElement("div");
    panel.id = "performance-monitor";
    panel.classList.add("perf-hidden");
    panel.innerHTML = `
    <div class="perf-title">Museum Performance</div>
    <div id="perf-fps">FPS: --</div>
    <div id="perf-frame">Frame: -- ms</div>
    <hr>
    <div id="perf-draw">Draw calls: --</div>
    <div id="perf-tris">Triangles: --</div>
    <div id="perf-geometries">Geometries: --</div>
    <div id="perf-textures">Textures: --</div>
    <small>Press P to hide/show</small>
    `;

    document.body.appendChild(panel);

    const fields = {
    fps: panel.querySelector("#perf-fps"),
    frame: panel.querySelector("#perf-frame"),
    draw: panel.querySelector("#perf-draw"),
    tris: panel.querySelector("#perf-tris"),
    geometries: panel.querySelector("#perf-geometries"),
    textures: panel.querySelector("#perf-textures")
    };

    let lastFrame = performance.now();
    let lastUpdate = lastFrame;
    let frames = 0;
    let totalFrameTime = 0;

    document.addEventListener("keydown", (event) => {
    if (
        event.code === "KeyP" &&
        !event.repeat &&
        !event.ctrlKey &&
        !event.metaKey &&
        !["INPUT", "TEXTAREA"].includes(
        document.activeElement?.tagName
        )
    ) {
        panel.classList.toggle("perf-hidden");
    }
    });

    function update() {
    const now = performance.now();
    const delta = now - lastFrame;
    lastFrame = now;

    // Avoid counting time spent in background tabs.
    if (document.hidden || delta > 250) {
        frames = 0;
        totalFrameTime = 0;
        lastUpdate = now;
        return;
    }

    frames++;
    totalFrameTime += delta;

    // Refresh the UI twice per second.
    if (now - lastUpdate < 500) return;

    const fps = frames * 1000 / totalFrameTime;
    const frameMs = totalFrameTime / frames;
    const info = renderer.info;

    fields.fps.textContent = `FPS: ${fps.toFixed(1)}`;
    fields.frame.textContent =
        `Frame: ${frameMs.toFixed(1)} ms`;

    fields.draw.textContent =
        `Draw calls: ${info.render.calls}`;

    fields.tris.textContent =
        `Triangles: ${info.render.triangles.toLocaleString()}`;

    fields.geometries.textContent =
        `Geometries: ${info.memory.geometries}`;

    fields.textures.textContent =
        `Textures: ${info.memory.textures}`;

    fields.fps.style.color =
        fps >= 55 ? "#86efac" :
        fps >= 40 ? "#facc15" : "#f87171";

    fields.draw.style.color =
        info.render.calls <= 150 ? "#86efac" :
        info.render.calls <= 300 ? "#facc15" : "#f87171";

    frames = 0;
    totalFrameTime = 0;
    lastUpdate = now;
    }

    return { update };
}
