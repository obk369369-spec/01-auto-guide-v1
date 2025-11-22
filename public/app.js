// 1번 도구용 클라이언트 로직 v1.4
// - 엑셀 고객 데이터 다중 파일 파싱·통합
// - 우선순위 고객 리스트 + 선택
// - 선택 고객 대상 안내서 문단 자동 생성
// - 후속조치 localStorage 저장

let customerRows = []; // 통합 고객 데이터
let priorityList = []; // 점수 계산 후 우선순위 리스트
let logLines = [];

function addLog(msg) {
  const ts = new Date().toLocaleString("ko-KR");
  const line = `[${ts}] ${msg}`;
  logLines.unshift(line);
  const logEl = document.getElementById("autoLog");
  if (logEl) {
    logEl.textContent = logLines.slice(0, 40).join("\n");
  }
}

function setProgress(step, status) {
  // step: 1~4, status: "대기" | "진행중" | "완료"
  const li = document.querySelector(`#progressList li[data-step="${step}"]`);
  if (!li) return;
  li.classList.remove("done", "active");
  if (status === "완료") li.classList.add("done");
  if (status === "진행중") li.classList.add("active");

  const label =
    step === 1
      ? "고객 데이터 불러오기"
      : step === 2
      ? "데이터 분석·우선순위"
      : step === 3
      ? "안내서 초안 생성"
      : "고객 반응·후속조치 기록";

  li.textContent = `${step}단계: ${label} - ${status}`;
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

function normalizeCustomerRow(row) {
  const name =
    row["성명"] || row["이름"] || row["Name"] || row["name"] || "";
  const email =
    row["이메일"] || row["email"] || row["Email"] || row["E-mail"] || "";
  const org =
    row["기관"] ||
    row["소속"] ||
    row["Organization"] ||
    row["소속기관"] ||
    "";
  const field =
    row["연구분야"] || row["연구 분야"] || row["분야"] || row["Field"] || "";
  const interest =
    row["관심분야"] ||
    row["관심 분야"] ||
    row["Interest"] ||
    row["관심"] ||
    "";
  const budgetRaw =
    row["연구비"] ||
    row["예산"] ||
    row["Budget"] ||
    row["연구비(만원)"] ||
    row["연구비(만 원)"] ||
    0;
  const budget =
    Number(String(budgetRaw).replace(/[^0-9]/g, "")) || 0;

  const recent =
    row["최근거래"] ||
    row["최근 거래"] ||
    row["최근구매"] ||
    row["최근 문의"] ||
    row["Recent"] ||
    "";

  return { name, email, org, field, interest, budget, recent };
}

function mergeCustomers(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const n = normalizeCustomerRow(r);
    if (!n.name && !n.email) return; // 이름·이메일 둘 다 없으면 제외
    const key = (n.email || "").toLowerCase() + "|" + n.name;
    if (!map.has(key)) {
      map.set(key, n);
      return;
    }
    const exist = map.get(key);
    // 빈 값은 채우고, 예산은 더 큰 값 유지
    if (!exist.org && n.org) exist.org = n.org;
    if (!exist.field && n.field) exist.field = n.field;
    if (!exist.interest && n.interest) exist.interest = n.interest;
    if (n.budget > exist.budget) exist.budget = n.budget;
    if (!exist.recent && n.recent) exist.recent = n.recent;
  });
  return Array.from(map.values());
}

function computeScore(cust) {
  let score = 0;
  if (cust.field) score += 1;
  if (cust.interest) score += 1;
  if (cust.budget >= 300) score += 1;
  if (cust.budget >= 1000) score += 2;
  if (cust.recent) score += 1;
  return score;
}

function analyzeCustomers(rows) {
  const merged = mergeCustomers(rows);
  const result = {
    total: merged.length,
    byField: {},
    byInterest: {},
    highBudget: [],
    merged,
  };

  merged.forEach((c) => {
    if (c.field) result.byField[c.field] = (result.byField[c.field] || 0) + 1;
    if (c.interest)
      result.byInterest[c.interest] = (result.byInterest[c.interest] || 0) + 1;
    if (c.budget >= 1000) result.highBudget.push(c);
  });

  // 우선순위 리스트
  priorityList = merged
    .map((c, idx) => ({
      ...c,
      score: computeScore(c),
      idx,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return result;
}

function renderAnalysisSummary(analysis) {
  const summaryEl = document.getElementById("analysisSummary");
  if (!summaryEl) return;

  const topFields = Object.entries(analysis.byField)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topInterests = Object.entries(analysis.byInterest)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let text = "";
  text += `■ 통합 후 전체 고객 수: ${analysis.total}명\n\n`;
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
      text += `  - ${c.name || "이름없음"} / ${
        c.org || "기관없음"
      } / 약 ${c.budget}만원 / 분야: ${c.field || "-"} / 관심: ${
        c.interest || "-"
      }\n`;
    });
  }

  summaryEl.value = text;
}

function renderPriorityTable() {
  const tbody = document.getElementById("priorityBody");
  const datalist = document.getElementById("customerNameList");
  if (!tbody || !datalist) return;

  tbody.innerHTML = "";
  datalist.innerHTML = "";

  priorityList.forEach((c, i) => {
    const tr = document.createElement("tr");

    const tdSel = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.index = String(i);
    tdSel.appendChild(checkbox);

    const tdRank = document.createElement("td");
    tdRank.textContent = String(i + 1);

    const tdName = document.createElement("td");
    tdName.textContent = c.name || "(이름없음)";

    const tdOrg = document.createElement("td");
    tdOrg.textContent = c.org || "";

    const tdField = document.createElement("td");
    tdField.textContent = c.field || "";

    const tdInterest = document.createElement("td");
    tdInterest.textContent = c.interest || "";

    const tdBudget = document.createElement("td");
    tdBudget.textContent = c.budget ? String(c.budget) : "";

    const tdScore = document.createElement("td");
    tdScore.textContent = String(c.score);

    tr.appendChild(tdSel);
    tr.appendChild(tdRank);
    tr.appendChild(tdName);
    tr.appendChild(tdOrg);
    tr.appendChild(tdField);
    tr.appendChild(tdInterest);
    tr.appendChild(tdBudget);
    tr.appendChild(tdScore);

    tbody.appendChild(tr);

    // datalist option
    const opt = document.createElement("option");
    opt.value = `${c.name || ""} / ${c.org || ""}`.trim();
    datalist.appendChild(opt);
  });
}

function getSelectedCustomers() {
  const checkboxes = document.querySelectorAll(
    '#priorityBody input[type="checkbox"]'
  );
  const selected = [];
  checkboxes.forEach((cb) => {
    if (cb.checked) {
      const i = Number(cb.dataset.index || "-1");
      if (!Number.isNaN(i) && priorityList[i]) {
        selected.push(priorityList[i]);
      }
    }
  });
  return selected;
}

function generateGuideDraft() {
  const draftEl = document.getElementById("guideDraft");
  const segmentEl = document.getElementById("targetSegment");
  if (!draftEl) return;

  const selected = getSelectedCustomers();
  const segment = segmentEl.value.trim() || "선택된 핵심 고객군";
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);

  if (selected.length === 0) {
    alert("2단계 우선순위 리스트에서 안내서를 보낼 고객을 한 명 이상 선택해 주세요.");
    return;
  }

  const header = [
    `1. 안내 목적`,
    `   - ${segment}에 대해, 현재 진행 중인 연구 및 관심 주제에 맞는 해외 시장조사 보고서를 신속하게 안내드리기 위함입니다.`,
    ``,
    `2. 대상 고객 현황 (${dateStr} 기준)`,
    `   - 아래 고객분들을 대상으로 우선 안내를 드립니다.`,
    ``,
  ];

  const customerLines = selected.map((c, idx) => {
    return [
      `   [${idx + 1}] ${c.name || "(이름없음)"} / ${c.org || ""}`,
      `        · 연구분야 : ${c.field || "-"}`,
      `        · 관심분야 : ${c.interest || "-"}`,
      `        · 연구비(추정) : ${c.budget ? c.budget + "만원" : "정보없음"}`,
      ``,
    ].join("\n");
  });

  const footer = [
    `3. 추천 보고서 제공 방식`,
    `   1) 각 고객님의 연구 주제와 가장 밀접한 시장·기술·기업 동향 보고서부터 우선 안내`,
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
  ];

  const text = [...header, ...customerLines, ...footer].join("\n");
  draftEl.value = text;

  addLog(
    `안내서 초안 생성: 선택 고객 ${selected.length}명, 세그먼트 = ${segment}`
  );
  setProgress(3, "완료");
}

function saveFollowupRecord() {
  const name = document.getElementById("followupCustomer").value.trim();
  const resp = document.getElementById("followupResponse").value;
  const nextDate = document.getElementById("followupNextDate").value;
  const memo = document.getElementById("followupMemo").value.trim();
  if (!name || !resp) {
    alert("고객 이름과 반응을 먼저 입력해 주세요.");
    return;
  }
  const ts = new Date().toLocaleString("ko-KR");
  const rec = { ts, name, resp, nextDate, memo };
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
    td4.textContent = rec.nextDate || "";
    const td5 = document.createElement("td");
    td5.textContent = rec.memo;
    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tr.appendChild(td4);
    tr.appendChild(td5);
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
  const fileListEl = document.getElementById("fileList");

  loadFollowupFromStorage();

  if (btnLoadLocal) {
    btnLoadLocal.addEventListener("click", async () => {
      const fileInput = document.getElementById("customerFiles");
      const statusEl = document.getElementById("loadStatus");
      if (!fileInput.files || fileInput.files.length === 0) {
        alert("엑셀 파일을 하나 이상 선택해 주세요.");
        return;
      }
      const files = Array.from(fileInput.files);
      try {
        setProgress(1, "진행중");
        statusEl.textContent = `엑셀 파일을 불러오는 중입니다 (${files.length}개)...`;
        addLog(`엑셀 다중 파일 불러오기 시작: ${files.length}개`);

        if (fileListEl) {
          fileListEl.innerHTML = "";
          files.forEach((f) => {
            const li = document.createElement("li");
            li.textContent = f.name;
            fileListEl.appendChild(li);
          });
        }

        const allRows = [];
        for (const f of files) {
          const rows = await handleLocalExcel(f);
          addLog(`파일 ${f.name} 파싱 완료, 행 수: ${rows.length}`);
          allRows.push(...rows);
        }

        customerRows = allRows;
        statusEl.textContent = `불러온 원시 행 수: ${allRows.length} (여러 시트 통합 기준)`;
        addLog(`모든 파일 파싱 완료, 총 행 수: ${allRows.length}`);

        if (btnAnalyze) btnAnalyze.disabled = allRows.length === 0;
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
      addLog("고객 데이터 분석·우선순위 계산을 시작합니다.");
      const analysis = analyzeCustomers(customerRows);
      renderAnalysisSummary(analysis);
      renderPriorityTable();
      addLog(
        `고객 데이터 분석 완료. 통합 고객 수: ${analysis.total}, 우선순위 리스트 길이: ${priorityList.length}`
      );
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
      addLog(`온라인에서 가져오기(자리 준비용) 호출: 키워드 = ${kw}`);
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
      document.getElementById("followupNextDate").value = "";
      document.getElementById("followupMemo").value = "";
    });
  }

  addLog("1번 도구 화면이 로드되었습니다 (v1.4).");
});
