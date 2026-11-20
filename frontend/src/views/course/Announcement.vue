<script setup>
import { useRoute, useRouter } from 'vue-router'
import { ref, computed, onMounted, watch } from 'vue'
import api from '@/api/client.js'
import ChatBot from '@/components/ChatBot.vue'
import { downloadFile, getFileUrl } from '@/utils/files.js'
import AttachmentIcon from '@/components/AttachmentIcon.vue'

const route = useRoute()
const router = useRouter()
const courseCode = computed(() => route.params.id)
const announcements = ref([])
const selectedAnnouncement = ref(null)
const showModal = ref(false)
const showAddAnnouncementModal = ref(false)

const user = ref({
  name: '',
  user_id: '',
  role: '',
})

const newAnnouncement = ref({
  title: '',
  content: '',
  is_pinned: false,
  notify: true,
})
const keptAttachments = ref([])
const announcementFiles = ref([])
const announcementFileInput = ref(null)

const IMAGE_OR_PDF = /\.(pdf|png|jpe?g|gif|webp|bmp)$/i

const resetAnnouncementForm = () => {
  newAnnouncement.value = { title: '', content: '', is_pinned: false, notify: true }
  keptAttachments.value = []
  announcementFiles.value = []
  if (announcementFileInput.value) announcementFileInput.value.value = ''
}

const openCreate = () => {
  resetAnnouncementForm()
  showAddAnnouncementModal.value = true
}

const isImageFile = (att) => IMAGE_OR_PDF.test(att?.file_name || att?.file_path || '') && !/\.pdf$/i.test(att?.file_name || att?.file_path || '')

const onAnnouncementFiles = (event) => {
  const list = event.target.files ? Array.from(event.target.files) : []
  const invalid = list.filter((file) => !IMAGE_OR_PDF.test(file.name))
  if (invalid.length) {
    alert('公告附件只能上傳圖檔（png、jpg、gif、webp、bmp）或 PDF')
    event.target.value = ''
    announcementFiles.value = []
    return
  }
  if (keptAttachments.value.length + list.length > 10) {
    alert('公告附件最多 10 個')
    event.target.value = ''
    announcementFiles.value = []
    return
  }
  announcementFiles.value = list
}

const downloadAttachment = async (att) => {
  try {
    await downloadFile(att?.file_path, att?.file_name || '附件')
  } catch (err) {
    alert(err.response?.data?.message || '下載附件失敗')
  }
}

const loadUser = async() => {
  const stored = localStorage.getItem("user")

  if (!stored) {
    router.push('/')
    return
  }

  user.value.user_id = stored

  try {
    const res = await api.get('/api/auth/me')
    user.value.role = res.data.role

    const user_inf = res.data.user
    user.value.name = user_inf?.name || ''
    // if(user.value.role == 'student' || user.value.role == 'ta' ){
    // }else{    }


  } catch {
    console.error('取得使用者資訊失敗')
  }
}

const fetchAnnouncements = async () => {
  try {


    const res = await api.get(`/api/courses/${courseCode.value}/announcements`)

    announcements.value = res.data.announcements

  } catch (err) {
    console.error('取得公告失敗', err)
  }
}

const openAnnouncement = async (item) => {
  selectedAnnouncement.value = item
  showModal.value = true
  if (user.value.role !== 'teacher') {
    await markAsRead(item.id)
    item.isNew = false
  }
}

const closeModal = () => {
  showModal.value = false
  selectedAnnouncement.value = null
}

const formatDate = (datetime) => {
  if (!datetime) return ''

  const parts = datetime.split(' ')
  const day = parts[1]
  const monthStr = parts[2]
  const year = parts[3]

  const monthMap = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04',
    May: '05', Jun: '06', Jul: '07', Aug: '08',
    Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  }

  const month = monthMap[monthStr]

  if (!year || !month || !day) return ''

  return `${year}.${month}.${day.padStart(2, '0')}`
}

const markAsRead = async (announcementId) => {
  try {

    await api.post(`/api/announcements/${announcementId}/read`, {
      announcement_id: announcementId
    })

  } catch (err) {
    console.error('記錄已讀失敗', err)
  }
}

const startEdit = (item) => {
  newAnnouncement.value = {
    id: item.id,
    title: item.title || '',
    content: item.content || '',
    is_pinned: Boolean(item.is_pinned),
    notify: true,
  }
  keptAttachments.value = Array.isArray(item.attachments) ? [...item.attachments] : []
  announcementFiles.value = []
  if (announcementFileInput.value) announcementFileInput.value.value = ''
  showAddAnnouncementModal.value = true
}

const deleteAnnouncement = async (item) => {
  if (!confirm('確定刪除此公告？')) return
  try {
    await api.delete(`/api/courses/${courseCode.value}/announcements/${item.id}`)
    if (selectedAnnouncement.value?.id === item.id) closeModal()
    await fetchAnnouncements()
  } catch (err) {
    alert(err.response?.data?.message || '刪除公告失敗')
  }
}

const createAnnouncement = async () => {
  if (!newAnnouncement.value.title || !newAnnouncement.value.content) {
    alert('請填寫標題和內容')
    return
  }

  try {
    const formData = new FormData()
    formData.append('title', newAnnouncement.value.title)
    formData.append('content', newAnnouncement.value.content)
    formData.append('is_pinned', newAnnouncement.value.is_pinned ? 'true' : 'false')
    formData.append('notify', newAnnouncement.value.notify ? 'true' : 'false')
    if (newAnnouncement.value.id) {
      formData.append(
        'keepAttachments',
        JSON.stringify(keptAttachments.value.map((att) => att.file_path).filter(Boolean)),
      )
    }
    announcementFiles.value.forEach((file) => formData.append('files', file))

    if (newAnnouncement.value.id) {
      await api.put(`/api/courses/${courseCode.value}/announcements/${newAnnouncement.value.id}`, formData)
    } else {
      await api.post(`/api/courses/${courseCode.value}/announcements`, formData)
    }

    showAddAnnouncementModal.value = false
    resetAnnouncementForm()
    fetchAnnouncements()

  } catch (err) {
    console.error('新增公告失敗', err)
    alert(err.response?.data?.message || '新增公告失敗')
  }
}

// 從通知點進來時（?announcement=ID）自動開啟該公告
const openFromQuery = async () => {
  const targetId = Number(route.query.announcement)
  if (!targetId) return
  const target = announcements.value.find((a) => a.id === targetId)
  if (target) await openAnnouncement(target)
  router.replace({ query: { ...route.query, announcement: undefined } })
}

onMounted(async() => {
  await loadUser()
  await fetchAnnouncements()
  await openFromQuery()
})

// 同一元件被重用（切換課程或再次點擊通知）時重新載入
watch(
  () => [route.params.id, route.query.announcement],
  async ([newId, newAnn], [oldId]) => {
    if (newId !== oldId) {
      closeModal()
      await fetchAnnouncements()
    }
    if (newAnn) await openFromQuery()
  },
)
</script>


<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold text-gray-800 border-l-4 border-[#337ab7] pl-3">
        課程公告
      </h2>
    </div>
    <button
      v-if="user.role === 'teacher'||user.role === 'ta'"
      @click="openCreate"
      class="bg-[#337ab7] text-white px-4 py-1.5 rounded text-sm font-bold tracking-wide hover:bg-[#285e8e] shadow-sm transition-colors flex items-center gap-1 mb-4"
    >
      ＋ 新增公告
    </button>

    <div class="bg-white border rounded shadow-sm overflow-hidden">

      <div class="flex bg-gray-100 text-sm font-bold text-gray-700 p-3 border-b">
        <div class="flex-1">標題</div>
        <div class="w-32 text-center">發布者</div>
        <div class="w-32 text-center">發布日期</div>
      </div>

      <ul class="divide-y divide-gray-200">
        <li
          v-for="item in announcements"
          :key="item.id"
          class="flex p-3 hover:bg-blue-50 cursor-pointer items-center text-[15px]"
          @click="openAnnouncement(item)"
        >
          <div class="flex-1 text-[#337ab7] hover:underline truncate pr-4">

            <span v-if="item.isNew" class="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded mr-2">
              NEW
            </span>

            {{ item.title }}
            <span v-if="item.attachments?.length" class="ml-2 inline-flex items-center gap-1 text-xs text-gray-500">
              <AttachmentIcon /> {{ item.attachments.length }}
            </span>
          </div>

          <div class="w-32 text-center text-gray-600 text-sm">
            {{ item.teacher_name }}
          </div>

          <div class="w-32 text-center text-gray-500 text-sm">
            {{ formatDate(item.created_at) }}
          </div>
          <div v-if="user.role === 'teacher' || user.role === 'ta'" class="flex gap-2 ml-2" @click.stop>
            <button type="button" class="text-sm text-blue-600 font-bold" @click="startEdit(item)">修改</button>
            <button type="button" class="text-sm text-red-600 font-bold" @click="deleteAnnouncement(item)">刪除</button>
          </div>
        </li>
      </ul>

      <div v-if="announcements.length === 0" class="p-10 text-center text-gray-500">
        目前尚無公告資料
      </div>
    </div>

    <div
      v-if="showModal"
      class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
      @click="closeModal"
    >
      <div
        class="bg-white p-6 rounded shadow-lg w-[32rem] max-w-[92vw] max-h-[85vh] overflow-y-auto"
        @click.stop
      >
        <h3 class="text-lg font-bold mb-3">
          {{ selectedAnnouncement?.title }}
        </h3>

        <p class="text-sm text-gray-600 mb-2">
          發布者：{{ selectedAnnouncement?.teacher_name }}
        </p>

        <p class="text-sm text-gray-500 mb-4">
          日期：{{ formatDate(selectedAnnouncement?.created_at) }}
        </p>

        <div class="text-sm text-gray-800 whitespace-pre-line">
          {{ selectedAnnouncement?.content }}
        </div>

        <div v-if="selectedAnnouncement?.attachments?.length" class="mt-4 border-t pt-3 space-y-3">
          <p class="text-xs font-bold text-gray-500">附件</p>
          <div v-for="(att, i) in selectedAnnouncement.attachments" :key="att.file_path || i">
            <img
              v-if="isImageFile(att)"
              :src="getFileUrl(att.file_path)"
              :alt="att.file_name || '附件'"
              class="max-h-48 rounded border mb-1"
            />
            <button type="button" class="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline" @click="downloadAttachment(att)">
              <AttachmentIcon /> {{ att.file_name || '附件' }}
            </button>
          </div>
        </div>

        <div class="flex justify-end mt-4">
          <button
            class="px-3 py-1 bg-blue-500 text-white rounded"
            @click="closeModal"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-if="showAddAnnouncementModal" class="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div class="bg-white p-6 rounded shadow-lg w-[32rem] max-w-[92vw] max-h-[90vh] overflow-y-auto text-sm">

      <h3 class="font-bold mb-3">{{ newAnnouncement.id ? '修改公告' : '新增公告' }}</h3>

      <!-- 公告標題 -->
      <input
        v-model="newAnnouncement.title"
        placeholder="公告標題"
        class="border p-2 w-full mb-2"
      />

      <!-- 公告內容 -->
      <textarea
        v-model="newAnnouncement.content"
        placeholder="公告內容"
        class="border p-2 w-full mb-2"
        rows="4"
      ></textarea>

      <label class="flex items-center gap-2 mb-3">
        <input type="checkbox" v-model="newAnnouncement.is_pinned" />
        置頂公告
      </label>

      <div class="mb-3">
        <label class="block text-xs font-bold text-gray-600 mb-1">附件（僅限圖檔與 PDF，最多 10 個）</label>
        <ul v-if="keptAttachments.length" class="mb-2 space-y-1">
          <li v-for="(att, i) in keptAttachments" :key="att.file_path || i" class="flex items-center justify-between bg-gray-50 border rounded px-2 py-1">
            <span class="truncate">{{ att.file_name || '附件' }}</span>
            <button type="button" class="text-red-600 text-xs font-bold ml-2" @click="keptAttachments.splice(i, 1)">移除</button>
          </li>
        </ul>
        <input
          ref="announcementFileInput"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,image/bmp,.pdf,application/pdf"
          class="block w-full text-sm text-gray-500"
          @change="onAnnouncementFiles"
        />
        <ul v-if="announcementFiles.length" class="mt-2 text-xs text-green-700 space-y-0.5 list-disc list-inside">
          <li v-for="(file, i) in announcementFiles" :key="i">{{ file.name }}</li>
        </ul>
      </div>

      <label class="flex items-start gap-2 mb-2 text-gray-700">
        <input type="checkbox" v-model="newAnnouncement.notify" class="mt-0.5" />
        <span>
          發布通知給學生
          <span class="block text-xs text-gray-500">預設會通知。取消勾選則只儲存，不發送通知。</span>
        </span>
      </label>

      <!-- 按鈕 -->
      <div class="flex justify-end gap-2 mt-4">
        <button @click="showAddAnnouncementModal = false; resetAnnouncementForm()" class="px-3 py-1 border rounded">
          取消
        </button>

        <button @click="createAnnouncement" class="px-3 py-1 bg-green-500 text-white rounded">
          {{ newAnnouncement.id ? '儲存' : '新增公告' }}
        </button>
      </div>
    </div>
  </div>

  <ChatBot
    :courseCode="courseCode"
    :studentCode="user.user_id"
    :role="user.role"
  />

</template>
