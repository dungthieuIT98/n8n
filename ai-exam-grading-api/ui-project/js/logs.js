document.addEventListener("DOMContentLoaded", async () => {
  window.AppLayout.init();

  let logs = [];

  window.AppUI.fillSelect(document.getElementById("log-filter-type"), window.AppUI.logTypeOptions(), true);
  window.AppUI.fillSelect(document.getElementById("log-filter-status"), window.AppUI.logStatusOptions(), true);

  ["log-filter-type", "log-filter-status", "log-filter-keyword", "log-filter-workflow"].forEach((id) => {
    document.getElementById(id).addEventListener(id.includes("keyword") || id.includes("workflow") ? "input" : "change", renderPage);
  });

  function formatPayload(value) {
    if (!value) {
      return "-";
    }
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  async function loadData() {
    const payload = await window.AppApi.list("logs", { limit: 100 });
    logs = payload.data;
  }

  async function showLogDetail(logId) {
    try {
      document.getElementById("log-modal-title").textContent = "Chi tiet log - Dang tai...";
      document.getElementById("log-detail-content").innerHTML = "<p>Dang tai du lieu...</p>";
      window.AppLayout.openModal("log-detail-modal");

      const result = await window.AppApi.detail("logs", logId);
      const log = result.data;

      if (!log) {
        document.getElementById("log-detail-content").innerHTML = "<p>Khong tim thay log.</p>";
        return;
      }

      document.getElementById("log-modal-title").textContent = `${log.log_type} - ${log.status}`;
      document.getElementById("log-detail-content").innerHTML = `
        <div class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Ref</div>
              <div class="font-bold">${log.ref_table}:${log.ref_id}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Exam code</div>
              <div class="font-bold">${log.exam_code || "-"}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">student_code</div>
              <div class="font-bold">${log.student_code || "-"}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">workflow_execution_id</div>
              <div class="font-bold">${log.workflow_execution_id}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Model</div>
              <div class="font-bold">${log.model_name || "-"}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-3">
              <div class="text-xs font-semibold text-slate-500">Thoi gian</div>
              <div class="font-bold">${log.created_at}</div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 p-4 space-y-3 text-sm">
            <div><span class="font-semibold">Thong diep:</span> ${log.message}</div>
            <div>
              <div class="font-semibold">Request</div>
              <pre class="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-3 overflow-auto text-xs">${formatPayload(log.request_payload)}</pre>
            </div>
            <div>
              <div class="font-semibold">Response</div>
              <pre class="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-3 overflow-auto text-xs">${formatPayload(log.response_payload)}</pre>
            </div>
            <div><span class="font-semibold">Loi:</span> ${log.error_message || "Khong co"}</div>
          </div>
        </div>
      `;
    } catch (error) {
      document.getElementById("log-detail-content").innerHTML = `<p style="color: red;">Loi: ${error.message}</p>`;
    }
  }

  function renderPage() {
    const type = document.getElementById("log-filter-type").value;
    const status = document.getElementById("log-filter-status").value;
    const keyword = document.getElementById("log-filter-keyword").value.trim().toLowerCase();
    const workflow = document.getElementById("log-filter-workflow").value.trim().toLowerCase();

    const rows = logs.filter((log) => {
      const haystack = `${log.exam_code || ""} ${log.student_code || ""} ${log.class_code || ""}`.toLowerCase();
      const workflowId = String(log.workflow_execution_id || "").toLowerCase();
      return (!type || log.log_type === type)
        && (!status || log.status === status)
        && (!keyword || haystack.includes(keyword))
        && (!workflow || workflowId.includes(workflow));
    }).map((log) => `
      <tr>
        <td class="py-2 px-3">${log.created_at}</td>
        <td class="py-2 px-3 font-semibold">${log.log_type}</td>
        <td class="py-2 px-3">${log.ref_table}:${log.ref_id}</td>
        <td class="py-2 px-3">${log.student_code || "-"}</td>
        <td class="py-2 px-3">${log.class_code || "-"}</td>
        <td class="py-2 px-3">${window.AppUI.renderStatus(log.status)}</td>
        <td class="py-2 px-3">${log.message}</td>
        <td class="py-2 px-3">${log.workflow_execution_id}</td>
        <td>
          <div class="flex flex-wrap gap-2 py-2 px-3">
            <button class="px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold" data-view-log="${log.id}">Xem</button>
            ${log.status === "failed" ? `<button class="px-2 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold" data-retry-log="${log.id}">Retry</button>` : ""}
          </div>
        </td>
      </tr>
    `).join("");

    document.getElementById("log-table-body").innerHTML = rows || '<tr><td colspan="9">Khong co log phu hop bo loc.</td></tr>';

    document.querySelectorAll("[data-view-log]").forEach((button) => {
      button.addEventListener("click", () => {
        showLogDetail(button.dataset.viewLog);
      });
    });

    document.querySelectorAll("[data-retry-log]").forEach((button) => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await window.AppApi.retryLog(button.dataset.retryLog);
          await loadData();
          renderPage();
        } catch (error) {
          window.alert(error.message);
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  try {
    await loadData();
    renderPage();
  } catch (error) {
    document.getElementById("log-table-body").innerHTML = `<tr><td colspan="9">${error.message}</td></tr>`;
  }
});