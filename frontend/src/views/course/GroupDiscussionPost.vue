<template>
  <article>
    <header class="flex flex-wrap items-center gap-2 mb-2">
      <strong class="text-sm text-gray-800">{{ post.authorName }}</strong>
      <span class="text-xs text-gray-400">{{ new Date(post.createdAt).toLocaleString() }}</span>
      <button
        v-if="isStaff || post.studentId === username"
        type="button"
        class="ml-auto text-xs font-bold text-red-600 hover:underline"
        @click="$emit('delete', post)"
      >
        刪除
      </button>
    </header>
    <p class="text-gray-700 whitespace-pre-wrap break-words">{{ post.content }}</p>
    <button
      v-if="post.attachmentFileName"
      type="button"
      class="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#337ab7] hover:underline disabled:opacity-50"
      :disabled="downloading"
      @click="downloadAttachment"
    >
      {{ downloading ? '下載中...' : `下載附件：${post.attachmentFileName}` }}
    </button>

    <form class="mt-3 flex flex-wrap items-center gap-2" @submit.prevent="reply">
      <input
        v-model="replyText"
        maxlength="10000"
        class="min-w-0 flex-1 border rounded px-3 py-2 text-sm"
        placeholder="回覆留言（可只附加 PDF）..."
      />
      <label class="flex items-center gap-1 text-xs text-gray-500">
        <span>附加 PDF</span>
        <input
          ref="replyFileInput"
          type="file"
          accept=".pdf,application/pdf"
          class="max-w-[190px]"
          @change="selectReplyAttachment"
        />
      </label>
      <button
        type="submit"
        class="text-sm font-bold text-[#337ab7] hover:underline disabled:opacity-50"
        :disabled="posting"
      >
        回覆
      </button>
    </form>
    <p v-if="replyAttachment" class="mb-3 text-xs text-gray-500">
      已選擇：{{ replyAttachment.name }}
    </p>

    <ul v-if="post.children.length" class="mt-3 ml-3 pl-4 border-l-2 border-gray-200 space-y-3">
      <li v-for="child in post.children" :key="child.id">
        <GroupDiscussionPost
          :post="child"
          :username="username"
          :is-staff="isStaff"
          :posting="posting"
          :on-reply="onReply"
          @delete="(item) => $emit('delete', item)"
        />
      </li>
    </ul>
  </article>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { downloadFile } from '@/utils/files.js'

defineOptions({ name: 'GroupDiscussionPost' })

const props = defineProps({
  post: { type: Object, required: true },
  username: { type: String, default: '' },
  isStaff: { type: Boolean, default: false },
  posting: { type: Boolean, default: false },
  onReply: { type: Function, required: true },
})

const emit = defineEmits(['delete'])
const replyText = ref('')
const replyAttachment = ref(null)
const replyFileInput = ref(null)
const downloading = ref(false)
const route = useRoute()

const selectReplyAttachment = (event) => {
  const file = event.target.files?.[0] || null
  if (file && (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf'))) {
    alert('只允許上傳 PDF 檔案')
    event.target.value = ''
    replyAttachment.value = null
    return
  }
  replyAttachment.value = file
}

const reply = async () => {
  const content = replyText.value.trim()
  if (!content && !replyAttachment.value) {
    alert('請輸入回覆或選擇 PDF 附件')
    return
  }
  const submitted = await props.onReply(props.post.id, content, replyAttachment.value)
  if (submitted) {
    replyText.value = ''
    replyAttachment.value = null
    if (replyFileInput.value) replyFileInput.value.value = ''
  }
}

const downloadAttachment = async () => {
  downloading.value = true
  try {
    await downloadFile(
      `/api/courses/${route.params.id}/groups/${route.params.groupId}/discussion/attachments/${props.post.id}/download`,
      props.post.attachmentFileName,
    )
  } catch (error) {
    alert(error.response?.data?.message || error.message || '下載附件失敗')
  } finally {
    downloading.value = false
  }
}
</script>
