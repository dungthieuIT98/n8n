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
        <h3>${log.log_type} - ${log.status}</h3>
        <div class="detail-meta">
          <div><strong>Ref</strong><br>${log.ref_table}:${log.ref_id}</div>
          <div><strong>Exam code</strong><br>${log.exam_code || "-"}</div>
          <div><strong>student_code</strong><br>${log.student_code || "-"}</div>
          <div><strong>workflow_execution_id</strong><br>${log.workflow_execution_id}</div>
          <div><strong>Model</strong><br>${log.model_name || "-"}</div>
          <div><strong>Thoi gian</strong><br>${log.created_at}</div>
        </div>
        <div class="list-card">
          <p><strong>Thong diep:</strong> ${log.message}</p>
          <p><strong>Request:</strong> <pre style="background: #f5f5f5; padding: 8px; overflow-x: auto;">${formatPayload(log.request_payload)}</pre></p>
          <p><strong>Response:</strong> <pre style="background: #f5f5f5; padding: 8px; overflow-x: auto;">${formatPayload(log.response_payload)}</pre></p>
          <p><strong>Loi:</strong> ${log.error_message || "Khong co"}</p>
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
        <td>${log.created_at}</td>
        <td>${log.log_type}</td>
        <td>${log.ref_table}:${log.ref_id}</td>
        <td>${log.student_code || "-"}</td>
        <td>${log.class_code || "-"}</td>
        <td>${window.AppUI.renderStatus(log.status)}</td>
        <td>${log.message}</td>
        <td>${log.workflow_execution_id}</td>
        <td>
          <div class="table-actions">
            <button class="secondary" data-view-log="${log.id}">Xem</button>
            ${log.status === "failed" ? `<button data-retry-log="${log.id}">Retry</button>` : ""}
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