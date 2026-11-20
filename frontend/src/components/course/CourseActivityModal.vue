<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-gray-200">
      <div class="bg-gray-100 px-6 py-4 border-b flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div>
            <h3 class="text-base font-bold text-gray-800">
              課程作業追蹤與學生可見性設定（課程：{{ courseCode }}）
            </h3>
            <p class="text-xs text-gray-500">僅限授課教師設定作業作答追蹤項目、記錄秒數與學生檢視權限</p>
          </div>
        </div>
        <button
          type="button"
          class="text-gray-400 hover:text-gray-600 text-2xl leading-none font-bold p-1"
          @click="emit('close')"
        >
          &times;
        </button>
      </div>

      <div class="p-6 bg-gray-50/50 space-y-5 overflow-y-auto max-h-[80vh] text-sm">
        <div class="flex items-center justify-between p-3.5 rounded-lg border bg-white shadow-sm">
          <div>
            <div class="font-bold text-gray-800 text-sm">啟用本課程作業操作記錄</div>
            <div class="text-xs text-gray-500 mt-0.5">關閉後，系統將暫停記錄該課程作業的所有學生行為</div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="config.enabled" class="sr-only peer" />
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#337ab7]"></div>
          </label>
        </div>

        <div class="flex items-center justify-between p-4 rounded-lg border border-indigo-200 bg-indigo-50/60 shadow-sm">
          <div>
            <div class="font-bold text-indigo-900 flex items-center gap-1.5 text-sm">
              <span>開放學生查看自己的作業操作記錄</span>
              <span class="text-[11px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">可見性控制</span>
            </div>
            <div class="text-xs text-indigo-700 mt-1">
              開啟後，學生在作業頁面可檢視自己在該作業被記錄的歷程；關閉後學生完全看不到。
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="config.studentVisible" class="sr-only peer" />
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        <div class="p-4 rounded-lg border border-blue-200 bg-blue-50/50 space-y-2 shadow-sm">
          <label class="block font-bold text-gray-800 text-xs">
            文字作答打字快照記錄間隔（秒）
          </label>
          <div class="flex items-center gap-2">
            <input
              type="number"
              v-model.number="config.inputIntervalSeconds"
              min="5"
              max="3600"
              step="5"
              class="w-28 border border-gray-300 rounded px-3 py-1.5 text-sm bg-white font-bold text-blue-700 focus:outline-none focus:border-blue-400"
            />
            <span class="font-bold text-gray-700 text-xs">秒（預設 30 秒）</span>
          </div>
          <p class="text-xs text-gray-500">
            學生於作答框輸入文字時，系統每隔指定秒數自動檢查是否有文字變更並記錄快照。內容未變更時不會重複記錄。
          </p>
        </div>

        <div class="border rounded-lg p-4 bg-white shadow-sm space-y-3">
          <div>
            <span class="font-bold text-gray-800 text-xs block">記錄項目細項控制（預設僅記錄文字輸入）：</span>
            <p class="text-[11px] text-gray-500 mt-0.5">
              系統與學生介面僅會顯示此處勾選之項目（例如僅勾選文字輸入，則批改與學生清單中只會顯示輸入框變更）。
            </p>
          </div>

          <div class="space-y-2.5 pt-1">
            <label class="flex items-center gap-2.5 text-xs text-gray-800 cursor-pointer select-none">
              <input type="checkbox" v-model="config.trackInputs" class="rounded text-[#337ab7] focus:ring-blue-400 w-4 h-4" />
              <span class="font-semibold">記錄文字作答打字進度快照 (INPUT_SNAPSHOT)</span>
              <span class="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">預設啟用</span>
            </label>

            <label class="flex items-center gap-2.5 text-xs text-gray-800 cursor-pointer select-none">
              <input type="checkbox" v-model="config.trackCopyViolations" class="rounded text-[#337ab7] focus:ring-blue-400 w-4 h-4" />
              <span>記錄學生嘗試複製/貼上之防作弊違規攔截 (COPY_BLOCKED)</span>
            </label>

            <label class="flex items-center gap-2.5 text-xs text-gray-800 cursor-pointer select-none">
              <input type="checkbox" v-model="config.trackFileUploads" class="rounded text-[#337ab7] focus:ring-blue-400 w-4 h-4" />
              <span>記錄作業檔案選擇與上傳 (FILE_UPLOAD)</span>
            </label>

            <label class="flex items-center gap-2.5 text-xs text-gray-800 cursor-pointer select-none">
              <input type="checkbox" v-model="config.trackClicks" class="rounded text-[#337ab7] focus:ring-blue-400 w-4 h-4" />
              <span>記錄繳交、收回、下載等按鈕點擊 (BUTTON_CLICK)</span>
            </label>
          </div>
        </div>

        <div class="border border-red-200 rounded-lg p-4 bg-red-50/40 space-y-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-bold text-red-900 flex items-center gap-1.5 text-sm">
                <span>輸入字數與節奏異常偵測（疑似非人類打字）</span>
                <span class="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold border border-red-200">防作弊輔助</span>
              </div>
              <div class="text-xs text-red-700 mt-0.5">
                當學生的打字速度明顯超出人類生理極限，或各字元輸入間隔毫秒完全一致時，系統會自動在批改頁標註紅字警示。
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" v-model="config.anomalyDetectionEnabled" class="sr-only peer" />
              <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>

          <div v-show="config.anomalyDetectionEnabled" class="space-y-3 pt-2 border-t border-red-200/60">
            <div class="space-y-1">
              <label class="block font-bold text-gray-800 text-xs">
                打字速度上限判定（每秒超過多少字算異常）：
              </label>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  v-model.number="config.maxCharsPerSecond"
                  min="3"
                  max="200"
                  step="1"
                  class="w-24 border border-gray-300 rounded px-3 py-1 text-sm bg-white font-bold text-red-700 focus:outline-none focus:border-red-400"
                />
                <span class="font-bold text-gray-700 text-xs">字 / 秒（預設 15 字/秒，一般中文打字極限約 8~12 字/秒）</span>
              </div>
              <p class="text-[11px] text-gray-500">
                若快照期間打字速度超過此門檻，或是瞬間貼上幾十個字，系統將自動以紅色標示為「速度異常」。
              </p>
            </div>

            <div class="pt-1">
              <label class="flex items-start gap-2.5 text-xs text-gray-800 cursor-pointer select-none">
                <input
                  type="checkbox"
                  v-model="config.checkFrequencyAnomaly"
                  class="rounded text-red-600 focus:ring-red-400 w-4 h-4 mt-0.5"
                />
                <div>
                  <span class="font-bold text-gray-800">判定輸入間隔頻率是否固定（機器人自動輸入檢測）</span>
                  <p class="text-[11px] text-gray-500 mt-0.5">
                    人類自然打字時各按鍵間隔均有微幅思考停頓（標準差通常 > 100ms）；若各按鍵間隔完全規律一致（如固定 50ms 一字），將標記為「疑似機器人腳本」。
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div class="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-2">
          <div>
            <strong>查看操作記錄位置提示：</strong>
            老師若欲查看學生的作答操作歷程，請至作業的「批改作業」頁面，即可檢視該位學生的即時輸入快照與歷程。
          </div>
        </div>
      </div>

      <div class="bg-gray-100 px-6 py-3 border-t flex justify-end gap-3">
        <button
          type="button"
          class="px-4 py-2 border rounded text-gray-600 bg-white hover:bg-gray-50 text-sm font-bold"
          @click="emit('close')"
        >
          取消
        </button>
        <button
          type="button"
          :disabled="savingConfig"
          @click="saveConfig"
          class="bg-[#337ab7] text-white px-6 py-2 rounded font-bold hover:bg-[#285e8e] transition-colors disabled:opacity-50 text-sm shadow-sm"
        >
          {{ savingConfig ? '儲存中...' : '儲存設定' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import api from '@/api/client.js'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  courseCode: { type: String, required: true },
  homeworkId: { type: [String, Number], default: null },
})

const emit = defineEmits(['close'])

const savingConfig = ref(false)

const config = reactive({
  enabled: true,
  trackClicks: false,
  trackFileUploads: false,
  trackInputs: true,
  trackCopyViolations: false,
  inputIntervalSeconds: 30,
  studentVisible: false,
  anomalyDetectionEnabled: true,
  maxCharsPerSecond: 15,
  checkFrequencyAnomaly: true,
})

const loadConfig = async () => {
  if (!props.courseCode) return
  try {
    const res = await api.get(`/api/courses/${props.courseCode}/activity-logs/config`)
    if (res.data) {
      Object.assign(config, res.data)
      if (res.data.inputIntervalSeconds !== undefined) {
        config.inputIntervalSeconds = Number(res.data.inputIntervalSeconds) || 30
      }
      if (res.data.maxCharsPerSecond !== undefined) {
        config.maxCharsPerSecond = Number(res.data.maxCharsPerSecond) || 15
      }
    }
  } catch (err) {
    console.error('載入課程設定失敗', err)
  }
}

const saveConfig = async () => {
  savingConfig.value = true
  try {
    const res = await api.put(`/api/courses/${props.courseCode}/activity-logs/config`, config)
    alert(res.data?.message || '課程追蹤設定儲存成功！')
    emit('close')
  } catch (err) {
    alert('儲存失敗：' + (err.response?.data?.message || err.message))
  } finally {
    savingConfig.value = false
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      loadConfig()
    }
  },
  { immediate: true },
)
</script>
