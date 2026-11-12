<template>
  <div class="flex justify-center mt-20">
    <div class="w-full max-w-sm px-4">
      <h1 class="text-xl font-bold text-gray-800 mb-6 text-center">忘記密碼</h1>
      <p class="text-sm text-gray-600 mb-4">
        請輸入帳號綁定的信箱。系統寄出驗證碼後，請至信箱查收，並在本頁輸入驗證碼與新密碼。
      </p>

      <form class="flex flex-col gap-4" @submit.prevent="sent ? resetPassword() : sendCode()">
        <input
          v-model="email"
          type="email"
          placeholder="信箱"
          required
          :readonly="sent"
          class="w-full bg-[#eef3fe] border-b-[3px] border-gray-300 px-4 py-3 text-lg text-gray-800 focus:outline-none focus:border-blue-400 focus:bg-[#e4ebf9] transition-colors"
          :class="sent ? 'opacity-80' : ''"
        />

        <template v-if="!sent">
          <button
            type="submit"
            class="w-full bg-[#337ab7] text-white py-2.5 rounded text-lg tracking-widest hover:bg-[#285e8e] transition-colors"
            :disabled="sending"
          >
            {{ sending ? '寄送中…' : '寄送驗證碼' }}
          </button>
        </template>

        <template v-else>
          <input
            v-model="code"
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="驗證碼"
            required
            class="w-full bg-[#eef3fe] border-b-[3px] border-gray-300 px-4 py-3 text-lg text-gray-800 tracking-[0.3em] focus:outline-none focus:border-blue-400 focus:bg-[#e4ebf9] transition-colors"
          />
          <input
            v-model="password"
            type="password"
            placeholder="新密碼（至少 8 字元）"
            required
            minlength="8"
            class="w-full bg-[#eef3fe] border-b-[3px] border-gray-300 px-4 py-3 text-lg text-gray-800 focus:outline-none focus:border-blue-400 focus:bg-[#e4ebf9] transition-colors"
          />
          <input
            v-model="confirmPassword"
            type="password"
            placeholder="確認新密碼"
            required
            class="w-full bg-[#eef3fe] border-b-[3px] border-gray-300 px-4 py-3 text-lg text-gray-800 focus:outline-none focus:border-blue-400 focus:bg-[#e4ebf9] transition-colors"
          />
          <button
            type="submit"
            class="w-full bg-[#337ab7] text-white py-2.5 rounded text-lg tracking-widest hover:bg-[#285e8e] transition-colors"
            :disabled="resetting"
          >
            {{ resetting ? '更新中…' : '重設密碼' }}
          </button>
          <button
            type="button"
            class="text-sm text-[#337ab7] hover:text-[#285e8e]"
            :disabled="sending"
            @click="sendCode"
          >
            {{ sending ? '寄送中…' : '重新寄送驗證碼' }}
          </button>
        </template>
      </form>

      <p v-if="message" class="mt-4 text-sm text-center" :class="error ? 'text-red-600' : 'text-green-700'">
        {{ message }}
      </p>
      <div class="mt-6 text-center text-[15px]">
        <router-link to="/" class="text-[#337ab7] hover:text-[#285e8e]">返回登入</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/client.js'

const router = useRouter()
const email = ref('')
const code = ref('')
const password = ref('')
const confirmPassword = ref('')
const sent = ref(false)
const sending = ref(false)
const resetting = ref(false)
const message = ref('')
const error = ref(false)

const sendCode = async () => {
  sending.value = true
  message.value = ''
  error.value = false
  try {
    const { data } = await api.post('/api/auth/forgot-password', {
      email: email.value.trim(),
    })
    sent.value = true
    message.value = data.message
  } catch (e) {
    error.value = true
    message.value = e.response?.data?.message || '寄送失敗'
  } finally {
    sending.value = false
  }
}

const resetPassword = async () => {
  if (password.value !== confirmPassword.value) {
    error.value = true
    message.value = '兩次輸入的新密碼不相符'
    return
  }
  resetting.value = true
  message.value = ''
  error.value = false
  try {
    const { data } = await api.post('/api/auth/reset-password', {
      email: email.value.trim(),
      code: code.value.trim(),
      password: password.value,
      confirmPassword: confirmPassword.value,
    })
    alert(data.message)
    router.push('/')
  } catch (e) {
    error.value = true
    message.value = e.response?.data?.message || '重設失敗'
  } finally {
    resetting.value = false
  }
}
</script>
