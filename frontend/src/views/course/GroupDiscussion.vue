<template>
  <section class="max-w-4xl mx-auto p-4">
    <header class="bg-white border rounded p-5 mb-5">
      <button
        type="button"
        class="text-sm text-[#337ab7] hover:underline mb-3"
        @click="router.push(`/course/${courseId}/group`)"
      >
        返回小組專區
      </button>
      <h1 class="text-xl font-bold text-gray-800">{{ groupName }}｜小組討論區</h1>
      <p class="text-sm text-gray-500 mt-1">討論內容會保留在此小組，不因組員變動而移動。</p>
    </header>

    <nav class="flex border-b mb-4" aria-label="小組討論區內容">
      <button
        type="button"
        class="px-4 py-2 text-sm font-bold border-b-2"
        :class="activeTab === 'posts' ? 'border-[#337ab7] text-[#337ab7]' : 'border-transparent text-gray-500'"
        @click="activeTab = 'posts'"
      >
        討論留言
      </button>
      <button
        type="button"
        class="px-4 py-2 text-sm font-bold border-b-2"
        :class="activeTab === 'files' ? 'border-[#337ab7] text-[#337ab7]' : 'border-transparent text-gray-500'"
        @click="activeTab = 'files'"
      >
        附件檔案（{{ attachments.length }}）
      </button>
    </nav>

    <template v-if="activeTab === 'posts'">
      <form class="bg-white border rounded p-4 mb-5" @submit.prevent="submitTopLevelPost">
        <textarea
          v-model="newPost"
          rows="3"
          maxlength="10000"
          placeholder="發表討論（可只附加 PDF）..."
          class="w-full border rounded px-3 py-2 text-sm"
        />
        <div class="flex flex-wrap items-center justify-between gap-3 mt-2">
          <label class="flex items-center gap-2 text-sm text-gray-600">
            <span>附加 PDF（選填）</span>
            <input
              ref="attachmentInput"
              type="file"
              accept=".pdf,application/pdf"
              class="max-w-[220px] text-xs"
              @change="selectAttachment"
            />
          </label>
          <button
            type="submit"
            class="bg-[#337ab7] text-white px-4 py-2 rounded text-sm font-bold disabled:opacity-50"
            :disabled="posting"
          >
            {{ posting ? '發表中...' : '發表留言' }}
          </button>
        </div>
        <p v-if="selectedAttachment" class="mt-2 text-xs text-gray-500">
          已選擇：{{ selectedAttachment.name }}
          <button type="button" class="ml-2 text-red-600 hover:underline" @click="clearAttachment">移除</button>
        </p>
      </form>

      <div v-if="loading" class="p-8 text-center text-gray-500">讀取討論內容中...</div>
      <div v-else-if="errorMessage" class="p-4 bg-red-50 border border-red-200 rounded text-red-700">
        {{ errorMessage }}
      </div>
      <div v-else-if="!threadTree.length" class="p-8 bg-white border rounded text-center text-gray-500">
        目前尚無留言，成為第一個發表看法的人吧。
      </div>
      <ul v-else class="space-y-3">
        <li v-for="post in threadTree" :key="post.id" class="bg-white border rounded p-4">
          <PostItem
            :post="post"
            :username="username"
            :is-staff="isStaff"
            :posting="posting"
            :on-reply="submitPost"
            @delete="deletePost"
          />
        </li>
      </ul>
    </template>

    <div v-else-if="loading" class="p-8 text-center text-gray-500">讀取附件清單中...</div>
    <div v-else-if="errorMessage" class="p-4 bg-red-50 border border-red-200 rounded text-red-700">
      {{ errorMessage }}
    </div>
    <div v-else-if="!attachments.length" class="p-8 bg-white border rounded text-center text-gray-500">
      目前沒有上傳過的附件。
    </div>
    <ul v-else class="space-y-2">
      <li
        v-for="attachment in attachments"
        :key="attachment.id"
        class="bg-white border rounded p-4 flex flex-wrap items-center justify-between gap-3"
      >
        <div class="min-w-0">
          <p class="font-bold text-gray-800 truncate">{{ attachment.attachmentFileName }}</p>
          <p class="text-xs text-gray-500 mt-1">
            {{ attachment.authorName }} · {{ new Date(attachment.createdAt).toLocaleString() }}
          </p>
          <p class="text-sm text-gray-600 mt-1 truncate">{{ attachment.content }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 text-sm font-bold text-[#337ab7] hover:underline disabled:opacity-50"
          :disabled="downloadingPostId === attachment.id"
          @click="downloadAttachment(attachment)"
        >
          {{ downloadingPostId === attachment.id ? '下載中...' : '下載 PDF' }}
        </button>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/client.js'
import { getRoleFromToken } from '@/utils/auth.js'
import { downloadFile } from '@/utils/files.js'
import PostItem from './GroupDiscussionPost.vue'

const route = useRoute()
const router = useRouter()
const courseId = route.params.id
const groupId = route.params.groupId
const username = localStorage.getItem('user') || ''
const isStaff = computed(() => ['teacher', 'ta'].includes(getRoleFromToken()))
const groupName = ref(`小組 ${groupId}`)
const posts = ref([])
const newPost = ref('')
const activeTab = ref('posts')
const selectedAttachment = ref(null)
const attachmentInput = ref(null)
const loading = ref(true)
const posting = ref(false)
const downloadingPostId = ref(null)
const errorMessage = ref('')
const attachments = computed(() =>
  posts.value.filter((post) => post.attachmentFileName),
)

const threadTree = computed(() => {
  const nodes = new Map(posts.value.map((post) => [Number(post.id), { ...post, children: [] }]))
  const roots = []
  for (const node of nodes.values()) {
    const parent = node.parentPostId == null ? null : nodes.get(Number(node.parentPostId))
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
})

const loadDiscussion = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data } = await api.get(`/api/courses/${courseId}/groups/${groupId}/discussion`)
    posts.value = data.posts
    groupName.value = data.groupName
  } catch (error) {
    errorMessage.value = error.response?.data?.message || error.message || '讀取小組討論失敗'
  } finally {
    loading.value = false
  }
}

const submitPost = async (parentPostId, content, attachment = null) => {
  const text = String(content || '').trim()
  if ((!text && !attachment) || posting.value) {
    if (!text && !attachment) alert('請輸入留言或選擇 PDF 附件')
    return false
  }
  posting.value = true
  try {
    const formData = new FormData()
    if (text) formData.append('content', text)
    if (parentPostId != null) formData.append('parentPostId', String(parentPostId))
    if (attachment) formData.append('file', attachment)
    await api.post(`/api/courses/${courseId}/groups/${groupId}/discussion`, formData)
    await loadDiscussion()
    return true
  } catch (error) {
    alert(error.response?.data?.message || error.message || '發表留言失敗')
    return false
  } finally {
    posting.value = false
  }
}

const submitTopLevelPost = async () => {
  if (await submitPost(null, newPost.value, selectedAttachment.value)) {
    newPost.value = ''
    clearAttachment()
  }
}

const selectAttachment = (event) => {
  const file = event.target.files?.[0] || null
  if (file && (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf'))) {
    alert('只允許上傳 PDF 檔案')
    event.target.value = ''
    selectedAttachment.value = null
    return
  }
  selectedAttachment.value = file
}

const clearAttachment = () => {
  selectedAttachment.value = null
  if (attachmentInput.value) attachmentInput.value.value = ''
}

const downloadAttachment = async (attachment) => {
  downloadingPostId.value = attachment.id
  try {
    await downloadFile(
      `/api/courses/${courseId}/groups/${groupId}/discussion/attachments/${attachment.id}/download`,
      attachment.attachmentFileName,
    )
  } catch (error) {
    alert(error.response?.data?.message || error.message || '下載附件失敗')
  } finally {
    downloadingPostId.value = null
  }
}

const deletePost = async (post) => {
  if (!confirm('刪除這則留言及其回覆？')) return
  try {
    await api.delete(`/api/courses/${courseId}/groups/${groupId}/discussion/${post.id}`)
    await loadDiscussion()
  } catch (error) {
    alert(error.response?.data?.message || error.message || '刪除留言失敗')
  }
}

onMounted(loadDiscussion)
</script>
