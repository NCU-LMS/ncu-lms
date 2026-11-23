<template>
  <div class="flex flex-col gap-6">

    <div class="bg-blue-50 border border-blue-200 rounded p-5 flex justify-between items-center shadow-sm">
      <div>
        <div class="flex items-center gap-2 mb-1 flex-wrap">
          <h2 class="text-xl font-bold text-[#337ab7]">正在批改：{{ studentData.name || '未命名' }}（{{ studentData.id }}）</h2>
          <span v-if="studentData.status === 'returned'" class="bg-red-100 text-red-700 px-2.5 py-0.5 rounded text-xs font-black border border-red-300">
            目前狀態：已退件
          </span>
          <span v-else-if="studentData.status === 'resubmitted'" class="bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded text-xs font-black border border-purple-300">
            目前狀態：學生已補交
          </span>
        </div>
        <div class="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
          <p>首次繳交：{{ studentData.uploadedAt }}</p>
          <p v-if="studentData.resubmittedAt" class="text-purple-700 font-bold">
            補交時間：{{ formatLogDate(studentData.resubmittedAt) }}
          </p>
          <p v-if="studentData.makeupDeadline" class="text-red-600 font-bold">
            補繳期限：{{ formatLogDate(studentData.makeupDeadline) }}
          </p>
        </div>
        <div v-if="studentData.returnReason" class="mt-2 text-xs bg-amber-100/70 border border-amber-300 rounded p-2 text-amber-900 font-medium max-w-2xl">
          <strong>退件原因：</strong>{{ studentData.returnReason }}
        </div>
      </div>
      <div v-if="gradingForm.score" class="text-right">
        <span class="block text-sm text-gray-500 mb-1">目前成績</span>
        <span class="text-2xl font-black text-green-600">{{ gradingForm.score }}</span>
      </div>
    </div>

    <div class="flex gap-6 items-start">

      <div class="flex-1 flex flex-col gap-5">
        <div v-if="hasPreviousVersion" class="bg-amber-50/70 border border-amber-300 rounded shadow-sm overflow-hidden">
          <div
            class="bg-amber-100/90 px-5 py-3 border-b border-amber-200 flex justify-between items-center cursor-pointer select-none hover:bg-amber-200/70 transition-colors"
            @click="showPreviousVersion = !showPreviousVersion"
          >
            <div class="flex items-center gap-2">
              <span class="text-xs text-amber-900 font-bold transition-transform duration-200" :class="{ 'rotate-90': showPreviousVersion }">▶</span>
              <span class="font-bold text-amber-950 text-sm">檢視退件前之原作業版本與評分</span>
              <span class="text-[11px] bg-white text-amber-800 px-2 py-0.5 rounded font-black border border-amber-300 shadow-xs">歷史紀錄</span>
            </div>
            <span class="text-xs text-amber-900 font-bold">{{ showPreviousVersion ? '收起 ▲' : '點擊展開檢視 ▼' }}</span>
          </div>

          <div v-show="showPreviousVersion" class="p-5 space-y-4 text-sm bg-white">
            <div class="bg-amber-50/50 p-3.5 rounded border border-amber-200 space-y-1.5 text-xs">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span class="font-bold text-gray-700">退件前評分：</span>
                  <span class="text-base font-black text-red-600">{{ studentData.previousScore || '未給分' }}</span>
                  <span v-if="studentData.returnedAt" class="ml-3 text-gray-500">退件時間：{{ formatLogDate(studentData.returnedAt) }}</span>
                </div>
                <div v-if="studentData.makeupDeadline" class="text-red-700 font-bold">
                  原設定補繳期限：{{ formatLogDate(studentData.makeupDeadline) }}
                </div>
              </div>
              <div v-if="studentData.returnReason" class="text-gray-800 pt-1 border-t border-amber-200">
                <span class="font-bold text-amber-900">退件原因：</span>{{ studentData.returnReason }}
              </div>
              <div v-if="studentData.previousFeedback" class="text-gray-700 pt-1">
                <span class="font-bold text-gray-800">退件前評語：</span>
                <p class="whitespace-pre-line mt-0.5">{{ studentData.previousFeedback }}</p>
              </div>
            </div>

            <div class="space-y-3">
              <h5 class="font-bold text-gray-800 text-xs">退件前學生作答內容：</h5>
              <div v-for="(prevAns, pIdx) in previousAnswersList" :key="pIdx" class="border rounded-lg p-3 bg-gray-50 text-xs space-y-1.5">
                <div class="font-bold text-[#337ab7]">第 {{ pIdx + 1 }} 題：{{ prevAns.title }}</div>
                <div v-if="prevAns.text" class="bg-white p-3 border rounded text-gray-800 font-mono whitespace-pre-line text-[13px]">
                  {{ prevAns.text }}
                </div>
                <div v-if="prevAns.fileName" class="bg-white p-2.5 border rounded flex items-center justify-between">
                  <span class="font-bold text-green-700">附件：{{ prevAns.fileName }}</span>
                  <button
                    v-if="prevAns.filePath"
                    type="button"
                    class="text-blue-600 hover:underline font-bold"
                    @click="downloadFile(prevAns.filePath, prevAns.fileName)"
                  >
                    下載此附件
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white border rounded shadow-sm overflow-hidden">
          <div class="bg-gray-100 px-5 py-3 border-b font-bold text-gray-700">學生作答內容</div>

          <div class="p-5 space-y-6">
            <div v-for="(ans, index) in studentAnswers" :key="ans.id" class="border rounded-lg p-5 bg-gray-50">
              <h4 class="font-bold text-[#337ab7] mb-2 text-[16px]">第 {{ index + 1 }} 題：{{ ans.questionTitle }}</h4>
              <p class="text-[14px] text-gray-600 mb-4 whitespace-pre-line border-b pb-3 border-gray-200">{{ ans.questionDescription }}</p>

              <div class="mt-3">
                <span class="text-[14px] font-bold text-gray-800 block mb-2">學生的回答：</span>

                <div v-if="ans.format === 'file'" class="bg-white p-4 border border-gray-200 rounded flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="text-sm text-gray-700 font-bold">{{ ans.fileName || '未上傳檔案' }}</span>
                  </div>
                  <button
                    v-if="ans.filePath"
                    type="button"
                    class="text-[#337ab7] hover:underline text-sm font-bold bg-blue-50 px-3 py-1 rounded border border-blue-200 disabled:opacity-60"
                    :disabled="downloadingAnswerId === ans.questionId"
                    @click="onDownloadAnswer(ans)"
                  >
                    {{ downloadingAnswerId === ans.questionId ? '下載中...' : '下載附件' }}
                  </button>
                </div>

                <div v-else-if="ans.format === 'text'" class="bg-white p-4 border border-gray-200 rounded text-[15px] text-gray-700 whitespace-pre-line font-mono">
                  {{ ans.textAnswer || '（未作答）' }}
                </div>
              </div>

              <div class="mt-5 border-t border-gray-200 pt-4 flex flex-col gap-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="text-[13px] text-gray-500">此題滿分：<span class="font-bold text-gray-800">{{ ans.maxScore }}</span>（100 ÷ 子題數，餘數配於前幾題）</span>
                  <div class="flex items-center gap-3">
                    <span class="text-[14px] font-bold text-gray-700">此題得分：</span>
                    <input
                      v-model="ans.score"
                      type="number"
                      min="0"
                      :max="ans.maxScore"
                      step="0.5"
                      class="w-24 border border-gray-300 rounded px-2 py-1 text-center text-blue-600 font-bold focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-[14px] font-bold text-gray-700">此題評語：</span>
                  <textarea
                    v-model="ans.feedback"
                    rows="2"
                    placeholder="針對這題給點建議..."
                    class="border border-gray-300 rounded p-2 text-sm w-full outline-none focus:border-blue-400"
                  ></textarea>
                </div>

                <div class="bg-indigo-50 border border-indigo-200 rounded p-3 text-sm">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-bold text-indigo-800">AI 建議評分（僅老師可見）</span>
                    <button
                      type="button"
                      class="px-3 py-1 rounded bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-60"
                      :disabled="aiLoadingId === ans.questionId || aiLoadingAll"
                      @click="aiGradeQuestion(ans)"
                    >
                      {{ aiLoadingId === ans.questionId ? 'AI 評分中...' : (ans.ai ? '重新評分' : 'AI 建議評分') }}
                    </button>
                  </div>
                  <p v-if="ans.aiError" class="mt-2 text-red-600">{{ ans.aiError }}</p>
                  <div v-else-if="ans.ai" class="mt-2 space-y-1 text-gray-700">
                    <p>建議分數：<span class="font-black text-indigo-700">{{ ans.ai.suggested_score }}</span> / {{ ans.maxScore }}</p>
                    <p v-if="ans.ai.reason" class="whitespace-pre-line"><span class="font-bold">評分理由：</span>{{ ans.ai.reason }}</p>
                    <p v-if="ans.ai.feedback" class="whitespace-pre-line"><span class="font-bold">建議評語：</span>{{ ans.ai.feedback }}</p>
                    <button type="button" class="mt-1 text-xs font-bold text-indigo-700 hover:underline" @click="applyAi(ans)">
                      套用建議分數與評語
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>

        <div class="bg-white border rounded shadow-sm overflow-hidden">
          <div
            class="bg-gray-100 px-5 py-3 border-b flex justify-between items-center cursor-pointer select-none hover:bg-gray-200/70 transition-colors"
            @click="studentLogsExpanded = !studentLogsExpanded"
          >
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs text-gray-500 font-bold transition-transform duration-200" :class="{ 'rotate-90': studentLogsExpanded }">▶</span>
              <span class="font-bold text-gray-700 text-sm">該學生作業作答歷程與操作記錄</span>
              <span class="text-xs bg-blue-100 text-[#337ab7] font-bold px-2 py-0.5 rounded">
                學號：{{ studentData.id || '載入中' }}
              </span>
              <span v-if="anomalyCount > 0" class="text-xs bg-red-100 text-red-700 border border-red-300 font-extrabold px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
                偵測到 {{ anomalyCount }} 筆疑似異常
              </span>
              <span class="text-xs text-gray-400">（依課程設定篩選僅顯示已啟用之記錄項目）</span>
            </div>
            <div class="flex items-center gap-3">
              <button
                v-if="studentLogsExpanded"
                type="button"
                class="text-xs text-blue-600 hover:underline font-bold"
                :disabled="loadingStudentLogs"
                @click.stop="fetchStudentLogs"
              >
                {{ loadingStudentLogs ? '載入中...' : '重新整理' }}
              </button>
              <span class="text-xs text-gray-600 font-medium">
                {{ studentLogsExpanded ? '收起 ▲' : '展開 ▼' }}
              </span>
            </div>
          </div>

          <div v-show="studentLogsExpanded" class="p-5 space-y-4">
            <div class="flex flex-wrap items-center gap-3 text-xs bg-gray-50 p-3 rounded border">
              <label
                class="flex items-center gap-1.5 cursor-pointer font-bold select-none text-xs px-2.5 py-1.5 rounded border transition-all shadow-sm"
                :class="logFilters.onlyAnomalies ? 'bg-red-50 text-red-700 border-red-400 ring-2 ring-red-200' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'"
              >
                <input
                  v-model="logFilters.onlyAnomalies"
                  type="checkbox"
                  class="rounded text-red-600 focus:ring-red-400 w-3.5 h-3.5"
                  @change="fetchStudentLogs"
                />
                <span>僅顯示異常紀錄 (非人類速度 / 頻率固定)</span>
              </label>

              <div class="flex items-center gap-1.5">
                <span class="font-bold text-gray-600">事件類型：</span>
                <select
                  v-model="logFilters.eventType"
                  class="border rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400 font-medium"
                  @change="fetchStudentLogs"
                >
                  <option value="">全部已啟用項目</option>
                  <option value="ANOMALY_ONLY">僅顯示異常紀錄</option>
                  <option value="INPUT_SNAPSHOT">文字輸入快照 (INPUT_SNAPSHOT)</option>
                  <option value="COPY_BLOCKED">防複製違規 (COPY_BLOCKED)</option>
                  <option value="FILE_UPLOAD">檔案上傳 (FILE_UPLOAD)</option>
                  <option value="BUTTON_CLICK">按鈕點擊 (BUTTON_CLICK)</option>
                </select>
              </div>

              <div class="flex-1 min-w-[160px]">
                <input
                  v-model="logFilters.search"
                  type="text"
                  placeholder="搜尋快照內容文字或元件標的..."
                  class="w-full border rounded px-3 py-1.5 bg-white focus:outline-none focus:border-blue-400"
                  @keydown.enter="fetchStudentLogs"
                />
              </div>

              <button
                type="button"
                class="px-3 py-1.5 bg-[#337ab7] text-white rounded font-bold hover:bg-[#285e8e] transition-colors shadow-sm"
                :disabled="loadingStudentLogs"
                @click="fetchStudentLogs"
              >
                搜尋
              </button>
            </div>

            <div v-if="loadingStudentLogs" class="text-center py-8 text-gray-400 text-xs">
              正在載入該學生的操作紀錄...
            </div>
            <div v-else-if="studentLogs.length === 0" class="text-center py-8 text-gray-400 text-xs bg-gray-50 rounded border">
              該學生目前尚無符合條件的操作記錄（{{ logFilters.onlyAnomalies ? '無任何異常紀錄，輸入正常' : '或未觸發文字輸入變更' }}）
            </div>
            <div v-else class="overflow-x-auto border rounded">
              <table class="w-full text-xs text-left">
                <thead class="bg-gray-100 text-gray-700 border-b">
                  <tr>
                    <th class="p-2.5 whitespace-nowrap">記錄時間</th>
                    <th class="p-2.5 whitespace-nowrap">事件類型</th>
                    <th class="p-2.5 whitespace-nowrap">操作標的</th>
                    <th class="p-2.5">作答進度 / 變更詳情與異常警示</th>
                    <th class="p-2.5 whitespace-nowrap">IP 位址</th>
                    <th class="p-2.5 whitespace-nowrap text-center">檢視</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr
                    v-for="log in studentLogs"
                    :key="log.id"
                    :class="[
                      log.is_anomaly
                        ? 'bg-red-50/90 border-l-4 border-l-red-600 hover:bg-red-100/70'
                        : 'hover:bg-blue-50/50'
                    ]"
                  >
                    <td class="p-2.5 text-gray-500 whitespace-nowrap font-mono">
                      {{ formatLogDate(log.client_timestamp || log.created_at) }}
                    </td>
                    <td class="p-2.5 whitespace-nowrap">
                      <div class="flex flex-col gap-1 items-start">
                        <span
                          v-if="log.is_anomaly"
                          class="px-2 py-0.5 rounded text-[11px] font-bold bg-red-600 text-white shadow-sm"
                        >
                          {{ getLogEventLabel(log.event_type) }}
                        </span>
                        <span
                          v-else
                          :class="getLogBadgeClass(log.event_type)"
                          class="px-2 py-0.5 rounded text-[11px] font-bold"
                        >
                          {{ getLogEventLabel(log.event_type) }}
                        </span>
                      </div>
                    </td>
                    <td
                      class="p-2.5 font-bold text-gray-700 whitespace-nowrap max-w-[150px] truncate"
                      :class="{'text-red-900': log.is_anomaly}"
                      :title="log.target_element"
                    >
                      {{ log.target_element || '—' }}
                    </td>
                    <td class="p-2.5">
                      <div :class="[log.is_anomaly ? 'text-red-950 font-medium font-mono text-[12px] bg-red-100/50 p-1.5 rounded border border-red-200' : 'text-gray-700']">
                        {{ getLogActionDataPreview(log.action_data) }}
                      </div>
                      <div v-if="log.is_anomaly && log.anomaly_reasons?.length" class="mt-1.5 flex flex-wrap gap-1.5">
                        <span
                          v-for="(reason, rIdx) in log.anomaly_reasons"
                          :key="rIdx"
                          class="inline-flex items-center gap-1 text-[11px] bg-red-100 text-red-800 font-extrabold px-2 py-0.5 rounded border border-red-300"
                        >
                          {{ reason }}
                        </span>
                      </div>
                    </td>
                    <td class="p-2.5 text-gray-500 whitespace-nowrap font-mono">{{ log.ip_address || '—' }}</td>
                    <td class="p-2.5 whitespace-nowrap text-center">
                      <button
                        v-if="log.action_data"
                        type="button"
                        class="hover:underline font-bold text-[11px]"
                        :class="[log.is_anomaly ? 'text-red-700' : 'text-blue-600']"
                        @click="activeLogDetail = log"
                      >
                        詳細數據
                      </button>
                      <span v-else class="text-gray-300">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div class="w-[320px] shrink-0 sticky top-6 flex flex-col gap-4">
        <div class="bg-white border rounded shadow-sm overflow-hidden">
          <div class="bg-[#337ab7] text-white px-5 py-3 font-bold text-center">評分與回饋</div>

          <form @submit.prevent="submitGrade" class="p-5 flex flex-col gap-4">
            <div>
              <div class="flex justify-between items-end mb-1">
                <label class="block text-sm font-bold text-gray-700">總分 <span class="text-red-500">*</span></label>
                <span class="text-[11px] text-[#337ab7] font-bold">系統會自動加總各題分數</span>
              </div>
              <input
                v-model="gradingForm.score"
                type="text"
                placeholder="例如: 85 或 A"
                required
                class="w-full bg-white border border-gray-300 rounded px-3 py-2 text-xl font-bold text-center text-gray-800 focus:outline-none focus:border-blue-400 focus:bg-[#eef3fe] transition-colors"
              />
            </div>

            <div>
              <label class="block text-sm font-bold text-gray-700 mb-1">給學生的整體評語</label>
              <textarea
                v-model="gradingForm.feedback"
                rows="6"
                placeholder="寫些鼓勵或建議的話吧..."
                class="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400 focus:bg-[#eef3fe] transition-colors resize-y"
              ></textarea>
            </div>

            <div v-if="studentData.status === 'returned'" class="p-2.5 bg-amber-50 border border-amber-300 rounded text-amber-800 text-xs">
              此作業處於退件待補交狀態，需待學生重新繳交後方可評分。
            </div>
            <button
              type="submit"
              :disabled="studentData.status === 'returned'"
              class="w-full bg-green-600 text-white font-bold py-2.5 rounded hover:bg-green-700 transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              儲存成績並返回
            </button>
            <button
              type="button"
              @click="openReturnModal"
              class="w-full bg-amber-500 text-white font-bold py-2 rounded hover:bg-amber-600 transition-colors mt-1.5 flex items-center justify-center gap-1.5 shadow-sm text-sm"
            >
              退件（要求學生補交）
            </button>
          </form>
        </div>

        <div class="bg-white border rounded shadow-sm p-4 flex flex-col gap-3 text-sm">
          <div class="font-bold text-indigo-800">AI 評分助手</div>
          <p class="text-xs text-gray-500">依各題老師設定的評分 Prompt 產生建議，僅供參考，不會自動儲存。</p>
          <button
            type="button"
            class="w-full bg-indigo-600 text-white font-bold py-2 rounded hover:bg-indigo-700 disabled:opacity-60"
            :disabled="aiLoadingAll || Boolean(aiLoadingId)"
            @click="aiGradeAll"
          >
            {{ aiLoadingAll ? 'AI 評分中...' : '全部題目 AI 建議評分' }}
          </button>
          <div v-if="aiTotal !== null" class="text-gray-700">
            AI 建議總分：<span class="font-black text-indigo-700 text-lg">{{ aiTotal }}</span>
            <button type="button" class="block mt-1 text-xs font-bold text-indigo-700 hover:underline" @click="applyAllAi">
              全部套用
            </button>
          </div>
          <button
            type="button"
            class="w-full border border-[#337ab7] text-[#337ab7] font-bold py-2 rounded hover:bg-blue-50 disabled:opacity-60"
            :disabled="pdfDownloading"
            @click="downloadMergedPdf"
          >
            {{ pdfDownloading ? '產生中...' : '下載此份合併 PDF' }}
          </button>
        </div>

      </div>

    </div>

    <div
      v-if="activeLogDetail"
      class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
      @click.self="activeLogDetail = null"
    >
      <div class="bg-white rounded-lg shadow-2xl max-w-lg w-full p-5 space-y-3 text-xs max-h-[85vh] flex flex-col">
        <div class="flex justify-between items-center border-b pb-2">
          <h4 class="font-bold text-gray-800 text-sm">學生操作快照詳細數據 (ID: {{ activeLogDetail.id }})</h4>
          <button type="button" class="text-gray-400 hover:text-gray-600 text-lg leading-none" @click="activeLogDetail = null">&times;</button>
        </div>

        <div class="overflow-y-auto flex-1 space-y-2">
          <div v-if="activeLogDetail.is_anomaly" class="p-3 bg-red-100/90 border border-red-300 rounded text-red-900 space-y-1">
            <div class="font-bold flex items-center gap-1.5 text-xs text-red-800">
              系統判定此筆紀錄存在輸入異常或作弊特徵：
            </div>
            <ul class="list-disc list-inside text-xs pl-2 space-y-0.5 font-bold">
              <li v-for="(reason, idx) in activeLogDetail.anomaly_reasons" :key="idx">
                {{ reason }}
              </li>
            </ul>
          </div>

          <div><span class="font-bold text-gray-500">學生學號：</span>{{ activeLogDetail.user_id }}</div>
          <div>
            <span class="font-bold text-gray-500">事件類型：</span>
            <span :class="activeLogDetail.is_anomaly ? 'text-red-700 font-bold' : ''">{{ activeLogDetail.event_type }}</span>
            <span v-if="activeLogDetail.is_anomaly" class="ml-2 px-1.5 py-0.5 bg-red-600 text-white rounded text-[10px] font-black">疑似異常</span>
          </div>
          <div><span class="font-bold text-gray-500">操作元件：</span>{{ activeLogDetail.target_element || '—' }}</div>
          <div><span class="font-bold text-gray-500">時間戳記：</span>{{ formatLogDate(activeLogDetail.client_timestamp || activeLogDetail.created_at) }}</div>
          <div>
            <span class="font-bold text-gray-500">快照內容結構：</span>
            <pre class="bg-gray-900 text-green-400 p-3 rounded mt-1 overflow-x-auto font-mono text-[11px] leading-relaxed">{{ formatJson(activeLogDetail.action_data) }}</pre>
          </div>
        </div>

        <div class="flex justify-end pt-2 border-t">
          <button type="button" class="px-4 py-1.5 bg-gray-200 text-gray-700 rounded font-bold hover:bg-gray-300" @click="activeLogDetail = null">關閉</button>
        </div>
      </div>
    </div>

    <div
      v-if="showReturnModal"
      class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
      @click.self="showReturnModal = false"
    >
      <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200">
        <div class="bg-amber-50 px-6 py-4 border-b flex justify-between items-center">
          <div class="flex items-center gap-2">
            <h3 class="text-base font-bold text-amber-900">退件作業（要求學生補交）</h3>
          </div>
          <button type="button" class="text-gray-400 hover:text-gray-600 text-2xl font-bold leading-none" @click="showReturnModal = false">&times;</button>
        </div>

        <form @submit.prevent="submitReturn" class="p-6 space-y-4 text-xs">
          <div>
            <label class="block font-bold text-gray-700 mb-1">
              退件原因 / 修改要求 <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="returnForm.reason"
              required
              rows="4"
              placeholder="請詳細說明退件原因（例如：作答不完整、未按格式撰寫等），此說明將於學生作業頁面顯示..."
              class="w-full border border-gray-300 rounded p-2.5 text-sm outline-none focus:border-amber-500"
            ></textarea>
          </div>

          <div class="bg-blue-50/70 p-3.5 rounded border border-blue-200 space-y-2">
            <label class="block font-bold text-gray-800">
              設定補繳截止時間（可選）
            </label>
            <input
              type="datetime-local"
              v-model="returnForm.makeupDeadline"
              class="border rounded px-3 py-1.5 bg-white text-sm focus:border-blue-400 outline-none w-full font-medium"
            />
            <p class="text-[11px] text-gray-500">
              若未設定，學生將按照原作業截止日進行補交（原截止日：{{ homeworkDeadlineText || '無' }}）。
            </p>
          </div>

          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              class="px-4 py-2 border rounded bg-white hover:bg-gray-50 font-bold text-gray-600 text-sm"
              @click="showReturnModal = false"
            >
              取消
            </button>
            <button
              type="submit"
              :disabled="returning"
              class="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2 rounded font-bold disabled:opacity-50 transition-colors shadow-sm text-sm"
            >
              {{ returning ? '處理中...' : '確認退件' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/client.js'
import { downloadFile, downloadApi } from '@/utils/files.js'

const route = useRoute()
const router = useRouter()
const courseId = route.params.id
const hwId = route.params.hwId
const submissionId = route.params.submissionId

const goBack = () => router.push(`/course/${courseId}/homework/${hwId}`)

const downloadingAnswerId = ref(null)
const onDownloadAnswer = async (ans) => {
  downloadingAnswerId.value = ans.questionId
  try {
    await downloadFile(ans.filePath, ans.fileName)
  } catch (e) {
    alert(e.response?.data?.message || '下載失敗，請確認檔案是否存在')
  } finally {
    downloadingAnswerId.value = null
  }
}

const studentData = ref({
  id: '',
  name: '',
  uploadedAt: '',
  status: 'submitted',
  returnReason: '',
  makeupDeadline: null,
  returnedAt: null,
  resubmittedAt: null,
  previousScore: null,
  previousFeedback: '',
  previousAnswerText: '',
  previousFilesJson: null,
})

const showReturnModal = ref(false)
const returning = ref(false)
const returnForm = reactive({
  reason: '',
  makeupDeadline: '',
})
const showPreviousVersion = ref(false)
const homeworkDeadlineText = ref('')
const previousAnswersList = ref([])

const hasPreviousVersion = computed(() => {
  return Boolean(
    studentData.value.previousScore ||
    studentData.value.previousAnswerText ||
    studentData.value.status === 'resubmitted' ||
    studentData.value.status === 'returned'
  )
})

const openReturnModal = () => {
  returnForm.reason = studentData.value.returnReason || ''
  returnForm.makeupDeadline = studentData.value.makeupDeadline
    ? new Date(new Date(studentData.value.makeupDeadline).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : ''
  showReturnModal.value = true
}

const submitReturn = async () => {
  if (!returnForm.reason.trim()) {
    alert('請填寫退件原因')
    return
  }
  returning.value = true
  try {
    await api.post(`/api/submissions/${submissionId}/return`, {
      returnReason: returnForm.reason.trim(),
      makeupDeadline: returnForm.makeupDeadline ? new Date(returnForm.makeupDeadline).toISOString() : null,
    })
    alert('作業已退件！已將作業狀態更新為退件並保留舊版本作業。')
    showReturnModal.value = false
    await loadData()
  } catch (err) {
    alert(err.response?.data?.message || '退件失敗')
  } finally {
    returning.value = false
  }
}

const studentLogs = ref([])
const loadingStudentLogs = ref(false)
const studentLogsExpanded = ref(true)
const activeLogDetail = ref(null)
const logFilters = reactive({
  eventType: '',
  search: '',
  onlyAnomalies: false,
})

const anomalyCount = computed(() => {
  return studentLogs.value.filter((l) => l.is_anomaly).length
})

const fetchStudentLogs = async () => {
  if (!studentData.value.id || !courseId) return
  loadingStudentLogs.value = true
  try {
    const params = {
      userId: studentData.value.id,
      homeworkId: hwId,
      eventType: logFilters.eventType || undefined,
      search: logFilters.search || undefined,
      onlyAnomalies: logFilters.onlyAnomalies ? true : undefined,
      limit: 100,
    }
    const res = await api.get(`/api/courses/${courseId}/activity-logs`, { params })
    studentLogs.value = res.data?.logs || []
  } catch (e) {
    console.error('取得學生操作歷程失敗', e)
  } finally {
    loadingStudentLogs.value = false
  }
}

const formatLogDate = (raw) => (raw ? new Date(raw).toLocaleString('zh-TW', { hour12: false }) : '-')

const getLogBadgeClass = (type) => {
  switch (type) {
    case 'INPUT_SNAPSHOT': return 'bg-amber-100 text-amber-800'
    case 'COPY_BLOCKED': return 'bg-red-100 text-red-700 font-black'
    case 'FILE_UPLOAD': return 'bg-purple-100 text-purple-700'
    case 'BUTTON_CLICK': return 'bg-blue-100 text-blue-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

const getLogEventLabel = (type) => {
  switch (type) {
    case 'INPUT_SNAPSHOT': return '打字快照'
    case 'COPY_BLOCKED': return '違規攔截'
    case 'FILE_UPLOAD': return '檔案上傳'
    case 'BUTTON_CLICK': return '按鈕點擊'
    default: return type
  }
}

const getLogActionDataPreview = (data) => {
  if (!data) return '—'
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { return data }
  }
  if (data.previewSnippet) {
    const diff = data.lengthDiff !== undefined ? ` (變更: ${data.lengthDiff > 0 ? '+' : ''}${data.lengthDiff} 字，目前共 ${data.currentLength} 字)` : ''
    return `"${data.previewSnippet}"${diff}`
  }
  if (data.action) return `嘗試 ${data.action} 操作已被攔截`
  if (data.filesSummary) return `上傳檔案: ${data.filesSummary.map(f => f.name).join(', ')}`
  return JSON.stringify(data).slice(0, 40)
}

const formatJson = (data) => {
  if (!data) return '無附加資料'
  if (typeof data === 'string') {
    try { return JSON.stringify(JSON.parse(data), null, 2) } catch { return data }
  }
  return JSON.stringify(data, null, 2)
}

const aiLoadingId = ref(null)
const aiLoadingAll = ref(false)
const pdfDownloading = ref(false)

const aiTotal = computed(() => {
  const graded = studentAnswers.value.filter((ans) => ans.ai)
  if (!graded.length) return null
  return graded.reduce((sum, ans) => sum + (Number(ans.ai.suggested_score) || 0), 0)
})

const aiGradeQuestion = async (ans) => {
  aiLoadingId.value = ans.questionId
  ans.aiError = ''
  try {
    const { data } = await api.post(
      `/api/submissions/${submissionId}/questions/${ans.questionId}/ai-grade`,
      { homeworkId: hwId },
    )
    ans.ai = data
  } catch (e) {
    ans.aiError = e.response?.data?.message || 'AI 評分失敗'
  } finally {
    aiLoadingId.value = null
  }
}

const aiGradeAll = async () => {
  aiLoadingAll.value = true
  try {
    const { data } = await api.post(`/api/submissions/${submissionId}/ai-grade`, { homeworkId: hwId })
    for (const item of data.perQuestion || []) {
      const ans = studentAnswers.value.find((a) => a.questionId === item.questionId)
      if (!ans) continue
      if (item.error) {
        ans.ai = null
        ans.aiError = item.error
      } else {
        ans.ai = item
        ans.aiError = ''
      }
    }
  } catch (e) {
    alert(e.response?.data?.message || 'AI 評分失敗')
  } finally {
    aiLoadingAll.value = false
  }
}

const applyAi = (ans) => {
  if (!ans.ai) return
  ans.score = String(ans.ai.suggested_score)
  if (ans.ai.feedback) ans.feedback = ans.ai.feedback
}

const applyAllAi = () => studentAnswers.value.forEach(applyAi)

const downloadMergedPdf = async () => {
  pdfDownloading.value = true
  try {
    await downloadApi(`/api/submissions/${submissionId}/pdf`, `${studentData.value.id || 'submission'}-合併作答.pdf`)
  } catch (e) {
    alert(e.response?.data?.message || '下載失敗')
  } finally {
    pdfDownloading.value = false
  }
}

function perQuestionMaxScores(n) {
  if (!n || n < 1) return [100]
  const base = Math.floor(100 / n)
  const rem = 100 - base * n
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0))
}

const studentAnswers = ref([])

const gradingForm = ref({
  score: '',
  feedback: ''
})

watch(
  () => studentAnswers.value,
  (newAnswers) => {
    const isAnyQuestionGraded = newAnswers.some(ans => Number(ans.score) > 0)

    if (isAnyQuestionGraded) {
      const total = newAnswers.reduce((sum, ans) => sum + (Number(ans.score) || 0), 0)
      gradingForm.value.score = String(total)
    }
  },
  { deep: true }
)

const loadData = async () => {
  try {
    const [subRes, hwRes] = await Promise.all([
      api.get(`/api/submissions/${submissionId}`),
      api.get(`/api/homeworks/${hwId}`)
    ])

    const subData = subRes.data
    const hwData = hwRes.data

    studentData.value = {
      id: subData.studentId,
      name: subData.studentName || '',
      uploadedAt: subData.submittedAt ? new Date(subData.submittedAt).toLocaleString() : '-',
      status: subData.status || 'submitted',
      returnReason: subData.returnReason || '',
      makeupDeadline: subData.makeupDeadline || null,
      returnedAt: subData.returnedAt || null,
      resubmittedAt: subData.resubmittedAt || null,
      previousScore: subData.previousScore || null,
      previousFeedback: subData.previousFeedback || '',
      previousGradedDetails: subData.previousGradedDetails || null,
      previousAnswerText: subData.previousAnswerText || '',
      previousFilesJson: subData.previousFilesJson || null,
    }
    homeworkDeadlineText.value = hwData.deadline ? new Date(hwData.deadline).toLocaleString() : ''

    fetchStudentLogs()

    gradingForm.value.score = subData.score || ''
    gradingForm.value.feedback = subData.feedback || ''

    let parsedAnswers = []
    try {
      if (subData.answerText) {
        parsedAnswers = JSON.parse(subData.answerText)
      }
    } catch (e) {
      console.error("解析學生答案失敗", e)
    }

    let gradedDetails = []
    try {
      if (subData.graded_details) gradedDetails = JSON.parse(subData.graded_details)
    } catch (e) {
      console.error("解析每題評分失敗", e)
    }

    let storedFiles = []
    try {
      storedFiles = subData.files_json ? JSON.parse(subData.files_json) : []
    } catch {
      storedFiles = []
    }
    const qs = hwData.questions || []
    const maxScores = perQuestionMaxScores(qs.length)
    studentAnswers.value = qs.map((q, index) => {
      const detail = gradedDetails[index] || {}
      const isFile = (q.answerFormat || q.answer_format) === 'file'
      const stored = storedFiles[index]
      const legacy = index === 0 ? { file_name: subData.file_name, file_path: subData.file_path } : null
      const file = stored?.file_path ? stored : legacy
      return {
        id: q.id || index,
        questionId: q.id,
        questionTitle: q.title,
        questionDescription: q.description,
        format: q.answerFormat || q.answer_format,
        textAnswer: parsedAnswers[index] || '',
        fileName: isFile ? file?.file_name || null : null,
        filePath: isFile ? file?.file_path || null : null,
        score: detail.score || '',
        feedback: detail.feedback || '',
        maxScore: maxScores[index] ?? 100,
        ai: null,
        aiError: '',
      }
    })

    let prevParsed = []
    try {
      if (subData.previousAnswerText) prevParsed = JSON.parse(subData.previousAnswerText)
    } catch {
      prevParsed = [subData.previousAnswerText]
    }
    let prevStoredFiles = []
    try {
      if (subData.previousFilesJson) prevStoredFiles = JSON.parse(subData.previousFilesJson)
    } catch {
      prevStoredFiles = []
    }
    previousAnswersList.value = qs.map((q, idx) => ({
      title: q.title,
      text: prevParsed[idx] || '',
      fileName: prevStoredFiles[idx]?.file_name || null,
      filePath: prevStoredFiles[idx]?.file_path || null,
    }))

  } catch (error) {
    alert(error.response?.data?.message || error.message)
    console.error(error)
  }
}

const submitGrade = async () => {
  if (studentData.value.status === 'returned') {
    alert('此作業目前處於退件待補交狀態，待學生重新繳交後方可進行評分')
    return
  }
  try {
    const payload = {
      score: String(gradingForm.value.score),
      feedback: gradingForm.value.feedback,
      // 1. 名字改成 gradedDetails，對齊後端 server.js
      // 2. 拿掉 JSON.stringify，因為後端已經有寫轉 JSON 的功能了
      gradedDetails: studentAnswers.value.map(ans => ({
        score: ans.score,
        feedback: ans.feedback
      }))
    }

    await api.post(`/api/submissions/${submissionId}/grade`, payload)

    alert('批改儲存成功')
    goBack()
  } catch (error) {
    alert(error.response?.data?.message || error.message)
    console.error(error)
  }
}

onMounted(loadData)
</script>
