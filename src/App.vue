<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
      <div class="max-w-6xl mx-auto px-4 md:px-6">
        <div class="flex justify-between items-center h-16">
          <h1 class="text-xl font-semibold text-gray-900">
            表情包快速格式化工具
          </h1>

          <div class="flex items-center space-x-4">
            <CustomSelect
              v-model="store.settings.selectedFormat"
              :options="Object.values(store.exportFormats)"
            />
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <!-- 左侧：列表和上传 -->
        <div class="lg:col-span-2 space-y-6">
          <!-- 表情包列表 -->
          <ImageList />
        </div>

        <!-- 右侧：封面和导出 -->
        <div class="space-y-6">
          <!-- 封面设置 -->
          <CoverUpload />

          <!-- 导出设置 -->
          <ExportPanel />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import CoverUpload from '@/components/CoverUpload.vue';
import CustomSelect from '@/components/CustomSelect.vue';
import ExportPanel from '@/components/ExportPanel.vue';
import ImageList from '@/components/ImageList.vue';
import { useStickerStore } from '@/stores/stickerStore';

const store = useStickerStore();
</script>
