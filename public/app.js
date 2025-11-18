// 매우 단순화한 1번 도구용 클라이언트 로직
// - 엑셀 고객 데이터 파싱
// - 기본 분석 요약
// - 안내서 초안 자동 생성
// - 후속조치 localStorage 저장

let customerRows = []; // 파싱된 고객 데이터
let logLines = [];

function addLog(msg) {
  const ts = new Date().toLocaleString("ko-KR");
  const line = `[${ts}] ${msg}`;
  logLines.unshift(line);
  const logEl = document.getElementById("autoLog");
  if (logEl) {
    logEl.textContent = logLines.slice(0, 20).join("\n");
  }
}

function setProgress(step, status) {
  // step: 1~4, status: "대기" | "진행중" | "완료"
  const li = document.querySelector(`#progressList li[data-step="${step}"]`);
  if (!li) return;
  li.classList.remove("done", "active");
  if (status === "완료") {
    li.classList.add("done");
  } else if (status === "진행중") {
    li.classList.add("active");
  }
  li.textContent = `${step}단계: ${
    step === 1
      ? "고객 데이터 불러오기"
      : step === 2
      ? "데이터 분석 요약"
      : step === 3
      ? "안내서 초안 생성"
      : "고객 반응·후속조치 기록"
  } - ${status}`;
}

function handleLocalExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function analyzeCustomers(rows) {
  const result = {
    total: rows.length,
    byField: {},
    byInterest: {},
    highBudget: [],
  };

  rows.forEach((row) => {
    const field =
      row["연구분야"] || row["연구 분야"] || row["분야"] || row["Field"] || "";
    const interest =
      row["관심분야"] ||
      row["관심 분야"] ||
      row["Interest"] ||
      row["관심"] ||
      "";
    const budget =
      Number(
        String(
          row["연구비"] ||
            row["예산"] ||
            row["Budget"] ||
            row["연구비(만원)"] ||
            0
        ).replace(/[^0-9]/g, "")
      ) || 0;
    const name = row["성명"] || row["이름"] || row["Name"] || "";
    const org =
      row["기관"] || row["소속"] || row["Organization"] || row["소속기관"] || "";

    if (field) {
      result.byField[field] = (result.byField[field] || 0) + 1;
    }
    if (interest) {
      result.byInterest[interest] = (result.byInterest[interest] || 0) + 1;
    }
    if (budget >= 1000) {
      result.highBudget.push({ name, org, budget, field, interest });
    }
  });

  return result;
}

function renderAnalysisSummary(analysis) {
  const summaryEl = document.getElementById("analysisSummary");
  const highlightsEl = document.getElementById("analysisHighlights");

  if (!summaryEl || !highlightsEl) return;

  const topFields = Object.entries(analysis.byField)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topInterests = Object.entries(analysis.byInterest)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let text = "";
  text += `■ 전체 고객 수: ${analysis.total}명\n\n`;
  text += "■ 상위 연구분야 Top 5\n";
  topFields.forEach(([field, cnt]) => {
    text += `  - ${field}: ${cnt}명\n`;
  });
  text += "\n■ 상위 관심분야 Top 5\n";
  topInterests.forEach(([interest, cnt]) => {
    text += `  - ${interest}: ${cnt}명\n`;
  });
  text += "\n■ 연구비 1,000만원 이상 주요 고객\n";
  if (analysis.highBudget.length === 0) {
    text += "  - 해당 없음\n";
  } else {
    analysis.highBudget.slice(0, 10).forEach((c) => {
      text += `  - ${c.name || "이름없음"} / ${c.org || "기관없음"} / 약 ${
        c.budget
      }만원 / 분야: ${c.field || "-"} / 관심: ${c.interest || "-"}\n`;
    });
  }

  summaryEl.value = text;

  highlightsEl.innerHTML = "";
  const li1 = document.createElement("li");
  li1.textContent = `전체 고객 수: ${analysis.total}명`;
  highlightsEl.appendChild(li1);

  if (topFields[0]) {
    const li2 = document.createElement("li");
    li2.textContent = `가장 많은 연구분야: ${topFields[0][0]} (${topFields[0][1]}명)`;
    highlightsEl.appendChild(li2);
  }
  if (topInterests[0]) {
    const li3 = document.createElement("li");
    li3.textContent = `가장 많은 관심분야: ${topInterests[0][0]} (${topInterests[0][1]}명)`;
    highlightsEl.appendChild(li3);
  }
  const li4 = document.createElement("li");
  li4.textContent = `연구비 1,000만원 이상 고객 수: ${analysis.highBudget.length}명`;
  highlightsEl.appendChild(li4);
}

function generateGuideDraft() {
  const draftEl = document.getElementById("guideDraft");
  const segmentEl = document.getElementById("targetSegment");
  const summaryEl = document.getElementById("analysisSummary");

  if (!draftEl) return;

  const segment = segmentEl.value.trim() || "선택된 핵심 고객군";
  const summary = summaryEl.value.trim() || "(아직 분석 요약이 없습니다)";

  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);

  const text = [
    `1. 안내 목적`,
    `   - ${segment}에 대해, 현재 진행 중인 연구 및 관심 주제에 맞는 해외 시장조사 보고서를 신속하게 안내드리기 위함입니다.`,
    ``,
    `2. 고객 데이터 기반 요약 (${dateStr} 기준)`,
    summary
      .split("\n")
      .map((l) => `   ${l}`)
      .join("\n"),
    ``,
    `3. 추천 보고서 제공 방식`,
    `   1) 고객님의 연구 주제와 가장 밀접한 시장·기술·기업 동향 보고서부터 우선 안내`,
    `   2) 필요 시 목차(TOC) 및 샘플 페이지를 추가 제공`,
    `   3) 예산 및 일정에 맞춰 1차·2차 후보 보고서로 나눠 제안`,
    ``,
    `4. 다음 단계 제안`,
    `   - 전화·이메일·온라인 미팅 중 편하신 방법으로 연락 주시면,`,
    `     세부 목차 및 가격, 납기, 보고서 활용 예 등을 구체적으로 안내드리겠습니다.`,
    ``,
    `5. 문의·연락처`,
    `   - 월드산업정보센터 (WORLD INDUSTRIAL INFORMATION CENTER)`,
    `   - Tel : (02)333-8337 / Fax : (02)333-8330`,
    `   - E-mail : info@worldic.co.kr`,
  ].join("\n");

  draftEl.value = text;
  addLog("안내서 초안이 생성되었습니다.");
  setProgress(3, "완료");
}

function saveFollowupRecord() {
  const name = document.getElementById("followupCustomer").value.trim();
  const resp = document.getElementById("followupResponse").value;
  const memo = document.getElementById("followupMemo").value.trim();
  if (!name || !resp) {
    alert("고객 이름과 반응을 먼저 입력해 주세요.");
    return;
  }
  const ts = new Date().toLocaleString("ko-KR");
  const rec = { ts, name, resp, memo };
  const key = "wic_auto_guide_followups_v1";
  const list = JSON.parse(localStorage.getItem(key) || "[]");
  list.unshift(rec);
  localStorage.setItem(key, JSON.stringify(list));
  renderFollowupLog(list);
  addLog(`후속조치 기록 저장: ${name} / ${resp}`);
  setProgress(4, "완료");
}

function renderFollowupLog(list) {
  const tbody = document.querySelector("#followupLog tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  list.slice(0, 50).forEach((rec) => {
    const tr = document.createElement("tr");
    const td1 = document.createElement("td");
    td1.textContent = rec.ts;
    const td2 = document.createElement("td");
    td2.textContent = rec.name;
    const td3 = document.createElement("td");
    td3.textContent = rec.resp;
    const td4 = document.createElement("td");
    td4.textContent = rec.memo;
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tbody.appendChild(tr);
  });
}

function loadFollowupFromStorage() {
  const key = "wic_auto_guide_followups_v1";
  const list = JSON.parse(localStorage.getItem(key) || "[]");
  renderFollowupLog(list);
}

document.addEventListener("DOMContentLoaded", () => {
  const btnLoadLocal = document.getElementById("btnLoadLocal");
  const btnAnalyze = document.getElementById("btnAnalyze");
  const btnFetchOnline = document.getElementById("btnFetchOnline");
  const btnGenerateDraft = document.getElementById("btnGenerateDraft");
  const btnSaveFollowup = document.getElementById("btnSaveFollowup");
  const btnClearFollowup = document.getElementById("btnClearFollowup");

  loadFollowupFromStorage();

  if (btnLoadLocal) {
    btnLoadLocal.addEventListener("click", async () => {
      const fileInput = document.getElementById("customerFile");
      const statusEl = document.getElementById("loadStatus");
      if (!fileInput.files || fileInput.files.length === 0) {
        alert("엑셀 파일을 먼저 선택해 주세요.");
        return;
      }
      const file = fileInput.files[0];
      try {
        setProgress(1, "진행중");
        statusEl.textContent = `엑셀 파일을 불러오는 중입니다: ${file.name}`;
        addLog(`엑셀 파일 불러오기 시작: ${file.name}`);
        const rows = await handleLocalExcel(file);
        customerRows = rows;
        statusEl.textContent = `불러온 행 수: ${rows.length} (첫 시트 기준)`;
        addLog(`엑셀 파싱 완료, 행 수: ${rows.length}`);
        if (btnAnalyze) btnAnalyze.disabled = rows.length === 0;
        setProgress(1, "완료");
      } catch (err) {
        console.error(err);
        statusEl.textContent = `엑셀 파싱 중 오류가 발생했습니다.`;
        addLog("엑셀 파싱 실패");
        setProgress(1, "대기");
      }
    });
  }

  if (btnAnalyze) {
    btnAnalyze.addEventListener("click", () => {
      if (!customerRows || customerRows.length === 0) {
        alert("먼저 엑셀 파일을 불러와 주세요.");
        return;
      }
      setProgress(2, "진행중");
      addLog("고객 데이터 분석을 시작합니다.");
      const analysis = analyzeCustomers(customerRows);
      renderAnalysisSummary(analysis);
      addLog("고객 데이터 분석이 완료되었습니다.");
      setProgress(2, "완료");
    });
  }

  if (btnFetchOnline) {
    btnFetchOnline.addEventListener("click", () => {
      const kw = document.getElementById("onlineKeyword").value.trim();
      if (!kw) {
        alert("검색할 키워드를 먼저 입력해 주세요.");
        return;
      }
      alert(
        "지금 버전은 온라인 수집은 실제로 실행하지 않고, 자리만 만들어 둔 상태입니다.\n" +
          "나중에 /api/fetch-customer 같은 엔드포인트를 붙이면 여기서 자동으로 데이터를 채울 수 있습니다."
      );
      addLog(`온라인에서 가져오기(프로토타입) 호출: 키워드 = ${kw}`);
    });
  }

  if (btnGenerateDraft) {
    btnGenerateDraft.addEventListener("click", () => {
      setProgress(3, "진행중");
      generateGuideDraft();
    });
  }

  if (btnSaveFollowup) {
    btnSaveFollowup.addEventListener("click", () => {
      saveFollowupRecord();
    });
  }

  if (btnClearFollowup) {
    btnClearFollowup.addEventListener("click", () => {
      document.getElementById("followupCustomer").value = "";
      document.getElementById("followupResponse").value = "";
      document.getElementById("followupMemo").value = "";
    });
  }

  addLog("1번 도구 화면이 로드되었습니다.");
});
