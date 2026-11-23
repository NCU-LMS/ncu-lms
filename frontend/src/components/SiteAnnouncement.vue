<template>
  <section class="w-full md:max-w-[840px] p-4 bg-white border border-gray-200 rounded-xl shadow-lg">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-bold text-gray-800">最新公告</h2>
      <button
        v-if="isAdmin"
        type="button"
        @click="openForm()"
        class="bg-[#337ab7] text-white px-4 py-1.5 rounded text-sm font-bold tracking-wide hover:bg-[#285e8e] shadow-sm transition-colors"
      >
        ＋ 新增公告
      </button>
    </div>
    <hr class="mb-4 border-t-4 border-blue-500" />

    <p v-if="loading" class="text-gray-500 py-4">載入中…</p>
    <p v-else-if="loadError" class="text-red-600 py-4">{{ loadError }}</p>
    <p v-else-if="!sortedList.length" class="text-gray-500 py-4">目前沒有公告</p>

    <ul v-else class="divide-y divide-gray-200">
      <li
        v-for="item in sortedList"
        :key="item.id"
        class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-3 px-1 hover:bg-blue-50 cursor-pointer"
        @click="openDetail(item)"
      >
        <div class="flex-1 min-w-0 flex items-center gap-2">
          <span
            class="shrink-0 text-xs px-1.5 py-0.5 rounded font-bold"
            :class="CATEGORY[item.category]?.cls || CATEGORY.notice.cls"
          >
            {{ CATEGORY[item.category]?.label || CATEGORY.notice.label }}
          </span>
          <span v-if="item.is_pinned" class="shrink-0 text-xs text-red-600 font-bold">置頂</span>
          <span class="text-[#337ab7] hover:underline truncate">{{ item.title }}</span>
        </div>

        <div class="flex items-center gap-3 text-sm text-gray-500 sm:shrink-0">
          <span>{{ formatDate(item.created_at) }}</span>
          <span v-if="isAdmin" class="flex gap-2" @click.stop>
            <button type="button" class="text-blue-600 font-bold" @click="openForm(item)">修改</button>
            <button type="button" class="text-red-600 font-bold" @click="remove(item)">刪除</button>
          </span>
        </div>
      </li>
    </ul>

    <!-- 公告詳情 -->
    <div
      v-if="selected"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
      @click="selected = null"
    >
      <div
        role="dialog"
        aria-modal="true"
        class="bg-white p-6 rounded shadow-lg w-full max-w-md max-h-[80vh] overflow-y-auto"
        @click.stop
      >
        <div class="flex items-center gap-2 mb-2">
          <span
            class="text-xs px-1.5 py-0.5 rounded font-bold"
            :class="CATEGORY[selected.category]?.cls || CATEGORY.notice.cls"
          >
            {{ CATEGORY[selected.category]?.label || CATEGORY.notice.label }}
          </span>
          <h3 class="text-lg font-bold break-words">{{ selected.title }}</h3>
        </div>
        <p class="text-sm text-gray-500 mb-4">{{ formatDate(selected.created_at) }}</p>
        <!-- 純文字顯示，不要改成 v-html，避免 XSS -->
        <div class="text-sm text-gray-800 whitespace-pre-line break-words">{{ selected.content }}</div>
        <div class="flex justify-end mt-4">
          <button class="px-3 py-1 bg-blue-500 text-white rounded" @click="selected = null">關閉</button>
        </div>
      </div>
    </div>

    <!-- 新增／修改（僅 admin 看得到入口，真正權限由後端檢查） -->
    <div
      v-if="isAdmin && showForm"
      class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4"
    >
      <form
        role="dialog"
        aria-modal="true"
        class="bg-white p-6 rounded shadow-lg w-full max-w-md text-sm"
        @submit.prevent="save"
      >
        <h3 class="font-bold mb-3">{{ form.id ? '修改公告' : '新增公告' }}</h3>

        <label class="block mb-1 text-gray-600">類型</label>
        <select v-model="form.category" class="border p-2 w-full mb-2 bg-white">
          <option value="update">更新</option>
          <option value="maintenance">維護</option>
          <option value="notice">通知</option>
        </select>

        <input
          v-model.trim="form.title"
          maxlength="100"
          placeholder="公告標題"
          required
          class="border p-2 w-full mb-2"
        />
        <textarea
          v-model.trim="form.content"
          maxlength="2000"
          placeholder="公告內容"
          required
          rows="5"
          class="border p-2 w-full mb-2"
        ></textarea>

        <label class="flex items-center gap-2 mb-2">
          <input type="checkbox" v-model="form.is_pinned" />
          置頂公告
        </label>

        <p v-if="formError" role="alert" class="text-red-600 mb-2">{{ formError }}</p>

        <div class="flex justify-end gap-2 mt-4">
          <button type="button" class="px-3 py-1 border rounded" @click="closeForm">取消</button>
          <button
            type="submit"
            :disabled="saving"
            class="px-3 py-1 bg-green-500 text-white rounded disabled:opacity-60"
          >
            {{ saving ? '儲存中…' : form.id ? '儲存' : '發布' }}
          </button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/api/client.js'

defineProps({
  isAdmin: { type: Boolean, default: false },
})

const CATEGORY = {
  update: { label: '更新', cls: 'bg-blue-100 text-blue-700' },
  maintenance: { label: '維護', cls: 'bg-amber-100 text-amber-700' },
  notice: { label: '通知', cls: 'bg-gray-100 text-gray-700' },
}

const announcements = ref([])
const loading = ref(false)
const loadError = ref('')
const selected = ref(null)

// 置頂優先，其次依日期新到舊
const sortedList = computed(() =>
  [...announcements.value].sort(
    (a, b) =>
      Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) ||
      new Date(b.created_at) - new Date(a.created_at)
  )
)

const formatDate = (raw) => {
  if (!raw) return ''
  const d = new Date(raw)
  if (isNaN(d)) return ''
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}.${mm}.${dd}`
}

const fetchAnnouncements = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get('/api/site-announcements')
    announcements.value = data.announcements || []
  } catch (err) {
    console.error('取得公告失敗', err)
    loadError.value = '公告載入失敗，請稍後再試'
  } finally {
    loading.value = false
  }
}

const openDetail = (item) => {
  selected.value = item
}

// ---------- admin：新增／修改／刪除 ----------
const emptyForm = () => ({ id: null, title: '', content: '', category: 'update', is_pinned: false })
const form = ref(emptyForm())
const showForm = ref(false)
const saving = ref(false)
const formError = ref('')

const openForm = (item = null) => {
  form.value = item
    ? {
        id: item.id,
        title: item.title || '',
        content: item.content || '',
        category: item.category || 'notice',
        is_pinned: Boolean(item.is_pinned),
      }
    : emptyForm()
  formError.value = ''
  showForm.value = true
}

const closeForm = () => {
  showForm.value = false
  form.value = emptyForm()
}

const save = async () => {
  if (saving.value) return
  if (!form.value.title || !form.value.content) {
    formError.value = '請填寫標題和內容'
    return
  }

  saving.value = true
  formError.value = ''
  try {
    const payload = {
      title: form.value.title,
      content: form.value.content,
      category: form.value.category,
      is_pinned: form.value.is_pinned,
    }
    if (form.value.id) {
      await api.put(`/api/admin/site-announcements/${form.value.id}`, payload)
    } else {
      await api.post('/api/admin/site-announcements', payload)
    }
    closeForm()
    await fetchAnnouncements()
  } catch (err) {
    formError.value = err.response?.data?.message || '儲存失敗，請稍後再試'
  } finally {
    saving.value = false
  }
}

const remove = async (item) => {
  if (!confirm(`確定刪除「${item.title}」？`)) return
  try {
    await api.delete(`/api/admin/site-announcements/${item.id}`)
    await fetchAnnouncements()
  } catch (err) {
    alert(err.response?.data?.message || '刪除公告失敗')
  }
}

onMounted(fetchAnnouncements)
</script>