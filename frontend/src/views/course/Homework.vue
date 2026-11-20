<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold text-gray-800 border-l-4 border-[#337ab7] pl-3">
        課程作業清單
      </h2>
    </div>

    <div v-if="['teacher', 'ta'].includes(userRole)" class="flex gap-2 mb-4 flex-wrap">
      <button
        @click="goToCreateHomework"
        class="bg-[#337ab7] text-white px-4 py-1.5 rounded text-sm font-bold tracking-wide hover:bg-[#285e8e] shadow-sm transition-colors flex items-center gap-1"
      >
        ＋ 新增作業
      </button>
      <button
        type="button"
        @click="showActivityModal = true"
        class="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-1.5 rounded text-sm font-bold tracking-wide hover:bg-indigo-100 shadow-sm transition-colors flex items-center gap-1"
      >
        作業操作記錄與追蹤設定
      </button>
    </div>

    <CourseActivityModal
      :is-open="showActivityModal"
      :course-code="courseId"
      @close="showActivityModal = false"
    />

    <div class="bg-white border rounded shadow-sm overflow-hidden">
      <div class="flex bg-gray-100 text-sm font-bold text-gray-700 p-3 border-b">
        <div class="flex-1">作業名稱</div>
        <div class="w-40 text-center">截止日期</div>
        <div class="w-32 text-center">狀態</div>
        <div class="w-24 text-center">成績</div>
      </div>

      <ul class="divide-y divide-gray-200">
        <li
          v-for="hw in homeworkList"
          :key="hw.id"
          @click="goToDetail(hw.id)"
          class="flex p-3 hover:bg-blue-50 cursor-pointer transition-colors items-center text-[15px]"
        >
          <div class="flex-1 text-[#337ab7] hover:underline truncate pr-4">
            {{ hw.title }}
          </div>
          <div class="w-40 text-center text-gray-500 text-sm">{{ hw.deadlineText }}</div>
          <div class="w-32 text-center text-sm">
            <span
              v-if="hw.isReturned"
              class="text-red-600 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded text-xs inline-block"
              :title="hw.returnReason ? `退件原因：${hw.returnReason}` : '作業已被退件，需補交'"
            >
              已退件
            </span>
            <span
              v-else-if="hw.isResubmitted"
              class="text-purple-700 font-bold bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-xs inline-block"
            >
              已補交
            </span>
            <span
              v-else
              :class="hw.isGraded ? 'text-green-600 font-bold' : hw.isSubmitted ? 'text-blue-600' : 'text-orange-500 font-bold'"
            >
              {{ hw.statusText }}
            </span>
          </div>
          <div class="w-24 text-center text-lg" :class="hw.score ? 'text-green-600' : 'text-gray-400'">
            {{ hw.scoreText }}
          </div>
        </li>
      </ul>
      <div v-if="isLoading" class="p-6 text-center text-gray-500">讀取中...</div>
      <div v-else-if="homeworkList.length === 0" class="p-6 text-center text-gray-500">目前尚無作業</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import api from '@/api/client.js'
import { getRoleFromToken } from '@/utils/auth.js'
import CourseActivityModal from '@/components/course/CourseActivityModal.vue'

const showActivityModal = ref(false)

const router = useRouter()
const route = useRoute()
const courseId = route.params.id

const userRole = computed(() => getRoleFromToken())
const isLoading = ref(false)

const homeworkList = ref([])

const formatDate = (raw) => {
  if (!raw) return '-'
  return new Date(raw).toLocaleString()
}

const loadHomeworkList = async () => {
  isLoading.value = true
  try {
    const { data: result } = await api.get(`/api/courses/${courseId}/homeworks`)
    homeworkList.value = result.map((item) => {
      const isReturned = item.status === 'returned'
      const isResubmitted = item.status === 'resubmitted'
      const isGraded = Boolean(item.score) || item.status === 'graded'
      const isSubmitted = Boolean(item.submissionId)

      let deadlineDisplay = formatDate(item.deadline)
      if (isReturned && item.makeupDeadline) {
        deadlineDisplay = `${formatDate(item.makeupDeadline)} (補繳)`
      }

      let statusText = '未繳交'
      if (['teacher', 'ta'].includes(userRole.value)) {
        statusText = `已繳交 ${item.submitCount || 0} / 已批改 ${item.gradedCount || 0}`
      } else if (isReturned) {
        statusText = '已退件'
      } else if (isResubmitted) {
        statusText = '已補交'
      } else if (isGraded) {
        statusText = '已批改'
      } else if (isSubmitted) {
        statusText = '待批改'
      }

      return {
        ...item,
        deadlineText: deadlineDisplay,
        isSubmitted,
        isGraded,
        isReturned,
        isResubmitted,
        scoreText: item.score || '-',
        statusText,
      }
    })
  } catch (error) {
    alert(error.response?.data?.message || error.message || '讀取作業失敗')
  } finally {
    isLoading.value = false
  }
}

const goToDetail = (hwId) => {
  router.push(`/course/${courseId}/homework/${hwId}`)
}

const goToCreateHomework = () => {
  router.push(`/course/${courseId}/homework/create`)
}

onMounted(loadHomeworkList)
</script>
