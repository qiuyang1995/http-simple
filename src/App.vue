<template>
  <el-container class="app-container">
    <el-aside width="250px" class="request-list-aside">
      <div class="aside-header">
        <div class="aside-header-left">
          <el-checkbox 
            v-model="allSelected"
            :indeterminate="selectedRequests.length > 0 && selectedRequests.length < requestList.length"
            class="select-all-checkbox"
          >
            全选
          </el-checkbox>
        </div>
        <div class="aside-header-buttons">
          <el-button type="primary" size="small" @click="createNewRequest">新建请求</el-button>
          <el-button 
            type="danger" 
            size="small" 
            :disabled="selectedRequests.length === 0"
            @click="batchDeleteRequests"
          >
            批量删除
          </el-button>
          <el-button 
            type="info" 
            size="small" 
            @click="showSettings"
            class="settings-button"
          >
            <el-icon><Setting /></el-icon>
          </el-button>
        </div>
      </div>
      <el-menu
        :default-active="currentRequestId || ''"
        class="request-menu"
        @select="handleRequestSelect"
      >
        <draggable
          v-model="requestList"
          item-key="id"
          animation="100"
          handle=".request-item-content"
          ghost-class="drag-ghost"
          chosen-class="drag-chosen"
          drag-class="drag-dragging"
          @end="saveRequestOrder"
        >
          <template #item="{ element: request }">
            <el-menu-item
              :index="request.id"
              :key="request.id"
              class="request-menu-item"
            >
              <div class="request-item-content">
                <el-checkbox 
                  v-model="request.selected" 
                  @click.stop 
                  @change="handleRequestSelect"
                />
                <el-input
                  v-if="request.isEditing"
                  v-model="request.name"
                  size="small"
                  @blur="saveRequestName(request)"
                  @keyup.enter="saveRequestName(request)"
                  v-focus
                />
                <span v-else class="request-name">
                  <span @dblclick="startEditingName(request)" class="request-text">{{ request.name }}</span>
                  <el-icon class="edit-icon" @click="startEditingName(request)"><Edit /></el-icon>
                </span>
                <el-button
                  type="default"
                  size="mini"
                  circle
                  @click.stop="copyRequest(request)"
                  class="copy-btn"
                  title="复制请求"
                >
                  <el-icon class="copy-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#606266" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <rect x="2" y="2" width="13" height="13" rx="2" ry="2"/>
                    </svg>
                  </el-icon>
                </el-button>
                <el-button
                  type="default"
                  size="mini"
                  circle
                  @click.stop="deleteRequest(request)"
                  class="delete-btn"
                  title="删除请求"
                >
                  <el-icon class="delete-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f56c6c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m5 0V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </el-icon>
                </el-button>
              </div>
            </el-menu-item>
          </template>
        </draggable>
      </el-menu>
    </el-aside>

    <el-container class="main-container">
      <div class="request-section">
        <div class="url-bar">
          <div class="url-input-group">
            <el-select
              v-model="currentEnvId"
              placeholder="选择环境"
              class="env-select"
              @change="handleEnvironmentChange"
            >
              <el-option
                v-for="env in environments"
                :key="env.id"
                :label="env.name"
                :value="env.id"
              />
            </el-select>
            <div class="url-input-wrapper">
              <el-input
                v-model="requestForm.url"
                placeholder="请输入请求URL"
                class="url-input"
                :autocomplete="'off'"
                @change="saveCurrentRequest"
                @input="handleUrlInput"
                @blur="syncUrlToParams"
                @keyup.enter="syncUrlToParams"
              >
                <template #prepend>
                  <el-select
                    v-model="requestForm.method"
                    @change="saveCurrentRequest"
                    class="method-select"
                  >
                    <el-option label="GET" value="GET" />
                    <el-option label="POST" value="POST" />
                    <el-option label="PUT" value="PUT" />
                    <el-option label="DELETE" value="DELETE" />
                    <el-option label="PATCH" value="PATCH" />
                  </el-select>
                </template>
                <template #input>
                  <span class="url-input-content">
                    <template v-if="requestForm.url">
                      <template v-for="(part, index) in parseUrlWithVariables(requestForm.url)" :key="index">
                        <span v-if="part.type === 'variable'" class="variable-highlight">{{ part.text }}</span>
                        <span v-else>{{ part.text }}</span>
                      </template>
                    </template>
                    <template v-else>&nbsp;</template>
                  </span>
                </template>
              </el-input>
            </div>
            <el-button 
              type="primary" 
              @click="sendRequest" 
              :loading="loading"
              class="send-button"
            >
              {{ loading ? '发送中...' : '发送请求' }}
            </el-button>
          </div>
        </div>

        <el-tabs v-model="requestActiveTab" class="request-tabs">
          <el-tab-pane label="Headers" name="headers" />
          <el-tab-pane label="Body" name="body" />
        </el-tabs>

        <div class="request-content">
          <div v-show="requestActiveTab === 'headers'" class="headers-container">
            <div v-for="(header, index) in requestForm.headers" :key="index" class="header-item">
              <div class="header-row">
                <el-input
                  v-model="header.key"
                  placeholder="Key"
                  class="header-key"
                  @input="(val) => {
                    if (val.toLowerCase() === 'content-type') {
                      header.isCustomContentType = false
                    }
                  }"
                >
                  <template #input>
                    <span>{{ highlightVariables(header.key) }}</span>
                  </template>
                </el-input>
                <template v-if="header.key.toLowerCase() !== 'content-type'">
                  <el-input
                    v-model="header.value"
                    placeholder="Value"
                    class="header-value"
                  >
                    <template #input>
                      <span>{{ highlightVariables(header.value) }}</span>
                    </template>
                  </el-input>
                </template>
                <el-select
                  v-else
                  v-model="header.value"
                  placeholder="选择或输入"
                  filterable
                  allow-create
                  default-first-option
                  class="header-value"
                >
                  <el-option
                    v-for="type in defaultContentTypes"
                    :key="type.value"
                    :label="type.label"
                    :value="type.value"
                  />
                </el-select>
                <el-button
                  v-if="requestForm.headers.length > 1"
                  type="danger"
                  circle
                  size="small"
                  @click="removeHeader(index)"
                  class="icon-button"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>
            <div class="add-header-row">
              <el-button
                type="primary"
                circle
                size="small"
                @click="addHeader"
                class="icon-button"
              >
                <el-icon><Plus /></el-icon>
              </el-button>
            </div>
          </div>
          
          <div v-show="requestActiveTab === 'body'" class="body-container">
            <div class="param-type-selector">
              <el-radio-group v-model="requestForm.paramType" @change="saveCurrentRequest">
                <el-radio :value="'params'">Params</el-radio>
                <el-radio :value="'json'">JSON</el-radio>
                <el-radio :value="'form'">Form Data</el-radio>
                <el-radio :value="'text'">Text</el-radio>
              </el-radio-group>
            </div>

            <div class="params-container">
              <template v-if="requestForm.paramType === 'params'">
                <div v-for="(param, index) in requestForm.queryParams" :key="index" class="form-param-item">
                  <div class="form-param-row">
                    <el-input
                      v-model="param.key"
                      placeholder="Key"
                      class="param-key"
                    />
                    <el-input
                      v-model="param.value"
                      placeholder="Value"
                      class="param-value"
                    />
                    <el-button
                      v-if="requestForm.queryParams.length > 1"
                      type="danger"
                      circle
                      size="small"
                      @click="requestForm.queryParams.splice(index, 1)"
                      class="icon-button"
                    >
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                </div>
                <div class="add-param-row">
                  <el-button
                    type="primary"
                    circle
                    size="small"
                    @click="requestForm.queryParams.push({ key: '', value: '' })"
                    class="icon-button"
                  >
                    <el-icon><Plus /></el-icon>
                  </el-button>
                </div>
              </template>
              <template v-else-if="requestForm.paramType === 'json'">
                <el-input
                  v-model="requestForm.params"
                  type="textarea"
                  :rows="10"
                  placeholder="请输入JSON格式的请求参数"
                  class="param-textarea"
                  :suggestions="getVariableSuggestions()"
                />
              </template>
              <template v-else-if="requestForm.paramType === 'form'">
                <div v-for="(param, index) in requestForm.formParams" :key="index" class="form-param-item">
                  <div class="form-param-row">
                    <el-input
                      v-model="param.key"
                      placeholder="Key"
                      class="param-key"
                    >
                      <template #input>
                        <span>{{ highlightVariables(param.key) }}</span>
                      </template>
                    </el-input>
                    <el-select v-model="param.type" class="param-type-select" style="width: 120px; margin: 0 8px;" :default-value="'Text'">
                      <el-option label="Text" value="Text" />
                      <el-option label="file" value="file" />
                    </el-select>
                    <template v-if="param.type === 'file'">
                      <div class="param-value">
                        <el-upload
                        class="param-file-upload"
                        :show-file-list="false"
                        :multiple="true"
                        :auto-upload="false"
                        :on-change="(file, fileList) => handleFormFileChange(file, fileList, index)"
                      >
                        <el-button size="small" type="primary">选择文件</el-button>
                      </el-upload>
                      <div v-if="param.files && param.files.length" class="file-list">
                        <div v-for="(file, fidx) in param.files" :key="file.uid || file.name" class="file-list-item">
                          <span class="file-name">{{ file.name }}</span>
                          <el-icon class="file-remove" @click="removeFormFile(index, fidx)"><Delete /></el-icon>
                        </div>
                      </div>
                      </div>
                    </template>
                    <template v-else>
                      <el-input
                        v-model="param.value"
                        placeholder="Value"
                        class="param-value"
                      >
                        <template #input>
                          <span>{{ highlightVariables(param.value) }}</span>
                        </template>
                      </el-input>
                    </template>
                    <el-button
                      v-if="requestForm.formParams.length > 1"
                      type="danger"
                      circle
                      size="small"
                      @click="removeFormParam(index)"
                      class="icon-button"
                    >
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                </div>
                <div class="add-param-row">
                  <el-button
                    type="primary"
                    circle
                    size="small"
                    @click="addFormParam"
                    class="icon-button"
                  >
                    <el-icon><Plus /></el-icon>
                  </el-button>
                </div>
              </template>
              <template v-else>
                <el-input
                  v-model="requestForm.textParams"
                  type="textarea"
                  :rows="10"
                  placeholder="请输入文本格式的请求参数"
                  class="param-textarea"
                  :suggestions="getVariableSuggestions()"
                />
              </template>
            </div>
          </div>
        </div>
      </div>

      <div class="response-section">
        <div class="response-header">
          <el-tabs v-model="responseActiveTab">
            <el-tab-pane label="JSON" name="json" />
            <el-tab-pane label="表格" name="table" />
          </el-tabs>
          
          <div v-if="responseData && (requestStats.totalCount > 0 || requestStats.requestTime > 0)" class="response-actions">
            <div class="response-stats">
              <span>总数据: {{ requestStats.totalCount }} 条</span>
              <span class="stats-divider">|</span>
              <span>请求用时: {{ requestStats.requestTime }}ms</span>
            </div>
            <div class="response-buttons">
              <!-- <el-checkbox v-model="autoOpenFile" class="auto-open-checkbox">自动打开文件</el-checkbox> -->
              <el-button type="primary" @click="copyResponse">复制数据</el-button>
              <el-button type="success" @click="exportToExcel">导出到Excel</el-button>
            </div>
          </div>
        </div>

        <div class="response-content">
          <div v-show="responseActiveTab === 'json'" class="json-container">
            <json-editor
              v-model="responseData"
              :options="editorOptions"
              :mode="'code'"
              class="json-editor"
            />
            <div v-if="jsonError" class="json-error">
              {{ jsonError }}
            </div>
          </div>
          <div v-show="responseActiveTab === 'table'" class="table-container">
            <el-table
              v-if="tableData.length"
              :data="tableData"
              style="width: 100%"
              border
              height="100%"
              :max-height="'100%'"
              :default-sort="{ prop: tableColumns[0], order: 'ascending' }"
            >
              <el-table-column
                type="index"
                label="序号"
                width="60"
                align="center"
                fixed="left"
              />
              <el-table-column
                v-for="(col, index) in tableColumns"
                :key="index"
                :prop="col"
                :label="col"
                sortable
                show-overflow-tooltip
                min-width="150"
              />
            </el-table>
            <div v-else class="empty-table">
              <el-empty description="暂无数据" />
            </div>
          </div>
        </div>
      </div>
    </el-container>

    <!-- 设置对话框 -->
    <el-dialog
      v-model="settingsVisible"
      title="环境变量设置"
      width="800px"
      destroy-on-close
    >
      <div class="environments-header">
        <el-button type="primary" @click="createEnvironment">新建环境</el-button>
      </div>
      
      <el-table :data="environments" style="width: 100%">
        <el-table-column prop="name" label="环境名称" width="180" />
        <el-table-column prop="description" label="描述" />
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button-group>
              <el-button size="small" @click="editEnvironment(scope.row)">编辑</el-button>
              <el-button 
                size="small" 
                type="danger" 
                @click="deleteEnvironment(scope.row)"
              >删除</el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>

      <!-- 环境变量编辑对话框 -->
      <el-dialog
        v-model="envDialogVisible"
        :title="envDialogType === 'create' ? '新建环境' : '编辑环境'"
        width="600px"
        append-to-body
      >
        <el-form :model="currentEnvironment" label-width="100px">
          <el-form-item label="环境名称">
            <el-input v-model="currentEnvironment.name" />
          </el-form-item>
          <el-form-item label="描述">
            <el-input v-model="currentEnvironment.description" type="textarea" />
          </el-form-item>
          <el-form-item label="变量">
            <div v-for="(variable, index) in currentEnvironment.variables" :key="index" class="variable-item">
              <el-input v-model="variable.key" placeholder="变量名" style="width: 200px" :suggestions="getVariableSuggestions()" />
              <el-input v-model="variable.value" placeholder="变量值" style="width: 300px" :suggestions="getVariableSuggestions()" />
              <el-button type="danger" circle @click="removeVariable(index)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <el-button type="primary" @click="addVariable">添加变量</el-button>
          </el-form-item>
        </el-form>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="envDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveEnvironment">确定</el-button>
          </span>
        </template>
      </el-dialog>
    </el-dialog>
  </el-container>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed, nextTick, onBeforeUnmount, h } from 'vue'
import axios from 'axios'
import JsonEditor from 'json-editor-vue3'
import * as XLSX from 'xlsx'
import { utils, write } from 'xlsx'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Plus, Edit, Setting } from '@element-plus/icons-vue'
import draggable from 'vuedraggable'

// 自定义指令：自动聚焦
const vFocus = {
  mounted: (el) => el.querySelector('input').focus()
}

const route = ref('')
const enterAction = ref({})
const autoOpenFile = ref(false)
const currentRequestId = ref('')
const requestList = ref([])

const defaultContentTypes = [
  { label: 'application/json', value: 'application/json' },
  { label: 'application/x-www-form-urlencoded', value: 'application/x-www-form-urlencoded' },
  { label: 'multipart/form-data', value: 'multipart/form-data' },
  { label: 'text/plain', value: 'text/plain' },
  { label: 'text/html', value: 'text/html' },
  { label: 'application/xml', value: 'application/xml' }
]

const requestForm = reactive({
  method: 'GET',
  url: '',
  headers: [
    { key: 'Content-Type', value: 'application/json', isCustomContentType: false },
    { key: 'Authorization', value: '' },
    { key: '', value: '' }
  ],
  paramType: 'json',
  queryParams: [{ key: '', value: '' }],
  params: '',
  formParams: [{ key: '', type: 'Text', value: '' }],
  textParams: ''
})

const responseData = ref('')
const jsonError = ref([])
const tableData = ref([])
const tableColumns = ref([])
const requestActiveTab = ref('headers')
const responseActiveTab = ref('json')
const loading = ref(false)

const requestStats = reactive({
  totalCount: 0,
  requestTime: 0
})

const selectedRequests = computed(() => {
  return requestList.value.filter(request => request.selected)
})

const allSelected = computed({
  get: () => {
    return requestList.value.length > 0 && requestList.value.every(request => request.selected)
  },
  set: (value) => {
    requestList.value.forEach(request => {
      request.selected = value
    })
  }
})

const editorOptions = {
  mainMenuBar: false,
  navigationBar: false,
  statusBar: false,
  mode: 'code',
  modes: ['code', 'tree'],
  onError: (error) => {
    jsonError.value = error.message
  },
  onChange: (content) => {
    try {
      // 将编辑器的内容解析为 JSON
      const parsedJson = JSON.parse(content)
      // 更新响应数据
      responseData.value = parsedJson
      // 更新表格数据
      convertToTable(parsedJson)
      jsonError.value = null
    } catch (error) {
      jsonError.value = error.message
    }
  }
}

// 修改 watch 部分，监听 responseData 的变化
watch(() => responseData.value, (newValue) => {
  if (newValue) {
    // 更新表格数据
    convertToTable(newValue)
  }
}, { deep: true })

const originalUrl = ref('')

let isSyncingUrlParams = false;

// 移除原有的 watch(() => requestForm.url, ...)，只保留记录 base 的功能
watch(() => requestForm.url, (newUrl) => {
  if (isSyncingUrlParams) return;
  if (typeof newUrl !== 'string') return;
  // 只记录 base，不做任何修改
  originalUrl.value = newUrl.split('?')[0];
});

// 只保留 params→url 的 watch
watch(() => requestForm.queryParams.map(p => p.key + '=' + p.value), () => {
  updateUrlWithParams();
});

function updateUrlWithParams() {
  // 只拼接参数部分，不覆盖 base，允许 url 自由输入
  let base = (requestForm.url || '').split('?')[0];
  const queryArr = (requestForm.queryParams || []).filter(p => p.key).map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`);
  if (queryArr.length) {
    requestForm.url = base + '?' + queryArr.join('&');
  } else {
    requestForm.url = base;
  }
}

// url→params 的同步只在失焦/回车时触发
function syncUrlToParams() {
  const url = requestForm.url || '';
  const [base, query] = url.split('?');
  originalUrl.value = base;
  if (query !== undefined) {
    const arr = query.split('&').map(pair => {
      const [k, v] = pair.split('=');
      return { key: decodeURIComponent(k || ''), value: decodeURIComponent(v || '') };
    }).filter(p => p.key);
    requestForm.queryParams = arr.length ? arr : [{ key: '', value: '' }];
  } else {
    requestForm.queryParams = [{ key: '', value: '' }];
  }
}

// 初始化 originalUrl
onMounted(() => {
  originalUrl.value = (requestForm.url || '').split('?')[0]
  window.utools.onPluginEnter(async (action) => {
    route.value = action.code
    enterAction.value = action
    // 先加载环境列表
    loadEnvironments()
    // 再加载请求列表
    loadRequestList()
    if (requestList.value.length > 0) {
      currentRequestId.value = requestList.value[0].id
      loadRequest(requestList.value[0])
    } else {
      await createNewRequest()
    }
  })
  
  window.utools.onPluginOut(async () => {
    if (currentRequestId.value) {
      // 清空响应数据
      responseData.value = ''
      tableData.value = []
      tableColumns.value = []
      requestStats.totalCount = 0
      requestStats.requestTime = 0
      
      // 保存当前请求（不包含响应数据）
      const currentRequest = requestList.value.find(r => r.id === currentRequestId.value)
      if (currentRequest) {
        try {
          const data = {
            method: requestForm.method || 'GET',
            url: requestForm.url || '',
            headers: requestForm.headers?.length ? requestForm.headers.map(h => ({
              key: h.key || '',
              value: h.value || '',
              isCustomContentType: !!h.isCustomContentType
            })) : [
              { key: 'Content-Type', value: 'application/json' },
              { key: 'Authorization', value: '' },
              { key: '', value: '' }
            ],
            paramType: requestForm.paramType || 'params',
            params: requestForm.params || '',
            formParams: requestForm.formParams?.length
              ? requestForm.formParams.map(p => ({
                  key: p.key || '',
                  value: p.value || '',
                  type: p.type || 'Text'
                  // 不保存 files 字段
                }))
              : [{ key: '', value: '', type: 'Text' }],
            textParams: requestForm.textParams || '',
            environmentId: currentEnvId.value // 添加环境ID
          }

          const dbData = {
            _id: `request_${currentRequestId.value}`,
            name: currentRequest.name,
            data: data
          }

          // 获取现有文档的 _rev
          const existingDoc = window.utools.db.get(`request_${currentRequestId.value}`)
          if (existingDoc && existingDoc._rev) {
            dbData._rev = existingDoc._rev
          }

          await window.utools.db.put(dbData)
        } catch (error) {
          console.error('退出时保存请求失败:', error)
        }
      }
    }
    route.value = ''
  })

    nextTick(() => {
    // initEditor()
  })
})

onBeforeUnmount(() => {
  // if (editor.value) {
  //   editor.value.destroy()
  // }
})

const addHeader = () => {
  requestForm.headers.push({ 
    key: '', 
    value: '',
    isCustomContentType: false // 新增字段，用于标记是否是自定义的 Content-Type
  })
}

const removeHeader = (index) => {
  requestForm.headers.splice(index, 1)
}

const addFormParam = () => {
  requestForm.formParams.push({ key: '', value: '', type: 'text', files: [] })
}

const removeFormParam = (index) => {
  requestForm.formParams.splice(index, 1)
}

// 添加处理 Content-Type 变化的函数
const handleContentTypeChange = (header, value) => {
  header.value = value
  header.isCustomContentType = !defaultContentTypes.some(type => type.value === value)
}

const sendRequest = () => {
  if (loading.value) return
  loading.value = true
  const startTime = Date.now()

  // 处理请求头
  const headers = {}
  requestForm.headers.forEach(header => {
    // 如果是 form-data，不要手动加 Content-Type，让浏览器自动生成带 boundary 的
    if (
      requestForm.paramType === 'form' &&
      header.key &&
      header.key.toLowerCase() === 'content-type'
    ) {
      return // 跳过 Content-Type
    }
    if (header.key && header.value) {
      headers[header.key] = replaceVariables(header.value)
    }
  })

  // 处理请求参数
  let params = {}
  if (requestForm.paramType === 'json') {
    try {
      const jsonStr = replaceVariables(requestForm.params)
      params = jsonStr ? JSON.parse(jsonStr) : {}
    } catch (e) {
      ElMessage.error('JSON格式错误，请检查格式')
      loading.value = false
      return
    }
  } else if (requestForm.paramType === 'form') {
    const formData = new FormData()
    requestForm.formParams.forEach(param => {
      if (param.key) {
        if (param.type === 'file' && param.files && param.files.length) {
          param.files.forEach(file => {
            formData.append(param.key, file)
          })
        } else if (param.type === 'Text') {
          // 允许 value 为空字符串、false、0
          formData.append(param.key, replaceVariables(param.value ?? ''))
        }
      }
    })
    params = formData
  } else {
    params = replaceVariables(requestForm.textParams) || ''
  }

  // 处理 URL
  let url = replaceVariables(requestForm.url)
  
  // 创建 XMLHttpRequest
  const xhr = new XMLHttpRequest()
  
  // 设置超时
  xhr.timeout = 3000000

  // 处理 GET 请求的参数
  if (requestForm.method === 'GET' && typeof params === 'object' && !(params instanceof FormData)) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, value)
    })
    const queryString = searchParams.toString()
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString
    }
  }

  // 打开连接
  xhr.open(requestForm.method, url, true)

  // 设置请求头
  Object.entries(headers).forEach(([key, value]) => {
    xhr.setRequestHeader(key, value)
  })

  // 设置响应类型
  xhr.responseType = 'json'

  // 处理响应
  xhr.onload = () => {
    const response = xhr.response
    
    // 更新请求统计
    requestStats.requestTime = Date.now() - startTime
    requestStats.totalCount = Array.isArray(response) ? response.length : 1

    try {
      // 更新响应数据
      responseData.value = response
      // 显示成功消息
      ElMessage.success(`请求成功 (${xhr.status})`)
    } catch (error) {
      console.error('处理响应数据时出错:', error)
      ElMessage.error('处理响应数据时出错：' + error.message)
      // 清空响应数据
      responseData.value = ''
      tableData.value = []
      tableColumns.value = []
    } finally {
      loading.value = false
    }
  }

  // 处理错误
  xhr.onerror = () => {
    ElMessage.error('网络错误，请检查网络连接')
    loading.value = false
    
    // 清空响应数据
    responseData.value = ''
    tableData.value = []
    tableColumns.value = []
  }

  // 处理超时
  xhr.ontimeout = () => {
    ElMessage.error('请求超时，请检查网络连接')
    loading.value = false
  }

  // 发送请求
  try {
    if (requestForm.method === 'GET') {
      xhr.send()
    } else {
      if (requestForm.paramType === 'json') {
        xhr.send(JSON.stringify(params))
      } else if (requestForm.paramType === 'form') {
        xhr.send(params)
      } else {
        xhr.send(params)
      }
    }
  } catch (error) {
    console.error('发送请求失败:', error)
    ElMessage.error('发送请求失败: ' + error.message)
    loading.value = false
  }
}

const convertToTable = (data) => {
  if (!data) {
    tableData.value = []
    tableColumns.value = []
    return
  }
  
  try {
    if (Array.isArray(data)) {
      // 处理数组数据
      tableData.value = data.map(item => {
        if (typeof item === 'object' && item !== null) {
          return item
        }
        return { value: item }
      })
      // 如果是基本类型数组，使用 value 作为列名
      if (data.length > 0 && typeof data[0] !== 'object') {
        tableColumns.value = ['value']
      } else {
        // 收集所有可能的列
        const columns = new Set()
        data.forEach(item => {
          if (item && typeof item === 'object') {
            Object.keys(item).forEach(key => columns.add(key))
          }
        })
        tableColumns.value = Array.from(columns)
      }
    } else if (typeof data === 'object' && data !== null) {
      tableData.value = [data]
      tableColumns.value = Object.keys(data)
    } else {
      tableData.value = [{ value: data }]
      tableColumns.value = ['value']
    }
  } catch (error) {
    console.error('转换表格数据失败:', error)
    tableData.value = []
    tableColumns.value = []
    ElMessage.error('转换表格数据失败: ' + error.message)
  }
}

const exportToExcel = () => {
  console.log('开始导出Excel...')
  if (!responseData.value) {
    console.log('没有响应数据，取消导出')
    ElMessage.warning('没有可导出的数据')
    return
  }

  try {
    console.log('开始转换表格数据...')
    // 确保使用最新的表格数据
    convertToTable(responseData.value)
    
    if (!tableData.value.length) {
      console.log('转换后的表格数据为空，取消导出')
      ElMessage.warning('没有可导出的数据')
      return
    }

    console.log('表格数据:', tableData.value)
    console.log('表格列:', tableColumns.value)

    // 生成带时间戳的文件名
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '')
    const fileName = `response_data_${timestamp}.xlsx`
    
    // 获取下载路径并规范化路径
    const downloadPath = window.utools.getPath('downloads').replace(/\\/g, '/')
    const filePath = `${downloadPath}/${fileName}`
    console.log('文件将保存到:', filePath)

    // 创建新的工作簿和工作表
    console.log('重新创建工作表...')
    const ws = XLSX.utils.json_to_sheet(tableData.value)
    console.log('重新创建工作簿...')
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    
    console.log('生成Excel文件内容(array格式)...')
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    console.log('Excel内容生成成功，开始创建Blob...')
    
    const blob = new Blob([wbout], { type: 'application/octet-stream' })
    console.log('Blob创建成功，大小:', blob.size)
    const url = URL.createObjectURL(blob)
    console.log('Blob URL创建成功:', url)
    
    console.log('创建下载链接...')
    const a = document.createElement('a')
    a.href = url
    a.download = fileName

    // 如果选中了自动打开文件，添加下载完成事件监听器
    if (autoOpenFile.value) {
      console.log('设置下载完成监听器...')
      a.addEventListener('click', () => {
        console.log('下载开始...')
        // 使用定时器延迟检查文件
        const startTime = Date.now()
        const checkInterval = 500 // 每500ms检查一次
        const maxWaitTime = 10000 // 最长等待10秒

        const checkFile = () => {
          console.log('检查文件是否存在...')
          try {
            const fs = window.require('fs')
            if (fs.existsSync(filePath)) {
              console.log('文件已找到，准备打开...')
              setTimeout(() => {
                try {
                  window.utools.shellOpenPath(filePath)
                  console.log('文件打开命令已执行')
                } catch (error) {
                  console.error('打开文件失败:', error)
                  ElMessage.warning('打开文件失败，请手动打开文件')
                }
              }, 1000) // 等待1秒后打开文件
              return
            }
          } catch (error) {
            console.error('检查文件时出错:', error)
          }

          // 如果超时，停止检查
          if (Date.now() - startTime > maxWaitTime) {
            console.log('等待超时，停止检查')
            ElMessage.warning('文件可能未正确保存，请手动打开文件')
            return
          }

          // 继续检查
          setTimeout(checkFile, checkInterval)
        }

        // 开始检查文件
        setTimeout(checkFile, 1000) // 首次检查延迟1秒
      }, { once: true }) // 确保事件监听器只触发一次
    }

    document.body.appendChild(a)
    console.log('触发下载...')
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    console.log('浏览器下载流程完成')

    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出数据失败:', error)
    console.error('错误堆栈:', error.stack)
    ElMessage.error('导出数据失败: ' + error.message)
  }
}

const copyResponse = () => {
  if (!responseData.value) {
    ElMessage.warning('没有可复制的数据')
    return
  }

  try {
    const textToCopy = JSON.stringify(responseData.value, null, 2)
    navigator.clipboard.writeText(textToCopy).then(() => {
      ElMessage.success('数据已复制到剪贴板')
    }).catch((err) => {
      console.error('复制失败:', err)
      // 如果 navigator.clipboard 失败，尝试使用传统方法
      const textarea = document.createElement('textarea')
      textarea.value = textToCopy
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        ElMessage.success('数据已复制到剪贴板')
      } catch (e) {
        ElMessage.error('复制失败，请手动复制')
      }
      document.body.removeChild(textarea)
    })
  } catch (error) {
    console.error('复制数据失败:', error)
    ElMessage.error('复制数据失败: ' + error.message)
  }
}

const clearForm = async () => {
  // 先保存当前状态
  if (currentRequestId.value) {
    await saveCurrentRequest()
  }
  
  requestForm.url = ''
  requestForm.headers = [{ key: '', value: '' }]
  requestForm.params = ''
  requestForm.formParams = [{ key: '', value: '' }]
  requestForm.textParams = ''
  
  // 清空响应数据
  responseData.value = ''
  tableData.value = []
  tableColumns.value = []
}

// 批量删除请求
const batchDeleteRequests = () => {
  if (selectedRequests.value.length === 0) return
  
  ElMessageBox.confirm(`确定要删除选中的 ${selectedRequests.value.length} 个请求吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    selectedRequests.value.forEach(request => {
      window.utools.db.remove(`request_${request.id}`)
      const index = requestList.value.findIndex(r => r.id === request.id)
      if (index > -1) {
        requestList.value.splice(index, 1)
      }
    })

    // 如果当前请求被删除，切换到第一个请求
    if (!requestList.value.find(r => r.id === currentRequestId.value)) {
      currentRequestId.value = requestList.value[0]?.id || ''
      if (currentRequestId.value) {
        loadRequest(requestList.value[0])
      }
    }
  }).catch(() => {
    // 用户取消删除操作，不做任何处理
  })
}

// 从 uTools DB 加载请求列表
const loadRequestList = () => {
  const requests = window.utools.db.allDocs('request_')
  requestList.value = requests.map(doc => ({
    id: doc._id.replace('request_', ''),
    name: doc.name || '新建请求',
    data: doc.data,
    isEditing: false,
    selected: false,
    _rev: doc._rev
  }))
}

// 创建新请求
const createNewRequest = async () => {
  const id = Date.now().toString();
  const newRequest = {
    id,
    name: '新建请求',
    data: {
      method: 'GET',
      url: '',
      headers: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Authorization', value: '' },
        { key: '', value: '' }
      ],
      paramType: 'params', // 默认选中 Params
      queryParams: [{ key: '', value: '' }],
      params: '',
      formParams: [{ key: '', value: '' }],
      textParams: ''
    },
    isEditing: false,
    selected: false
  };
  
  // 确保存储的数据是纯粹的对象
  const dbData = {
    _id: `request_${id}`,
    name: newRequest.name,
    data: JSON.parse(JSON.stringify(newRequest.data))
  }
  
  try {
    const result = await window.utools.db.put(dbData)
    if (result.ok) {
      newRequest._rev = result.rev
      requestList.value.push(newRequest)
      currentRequestId.value = id
      loadRequest(newRequest)
    } else {
      throw new Error('创建新请求失败')
    }
  } catch (error) {
    console.error('创建新请求失败:', error)
    ElMessage.error(`创建新请求失败: ${error.message}`)
  }
}

// 加载请求数据
const loadRequest = (request) => {
  // 先重置表单
  requestForm.method = 'GET'
  requestForm.url = ''
  requestForm.headers = [
    { key: 'Content-Type', value: 'application/json' },
    { key: 'Authorization', value: '' },
    { key: '', value: '' }
  ]
  requestForm.paramType = 'json'
  requestForm.params = ''
  requestForm.formParams = [{ key: '', value: '' }]
  requestForm.textParams = ''
  
  // 使用深拷贝来避免引用问题
  const data = JSON.parse(JSON.stringify(request.data))
  
  // 确保所有属性都被正确赋值
  requestForm.method = data.method || 'GET'
  requestForm.url = data.url || ''
  requestForm.headers = data.headers?.length ? data.headers : [
    { key: 'Content-Type', value: 'application/json' },
    { key: 'Authorization', value: '' },
    { key: '', value: '' }
  ]
  requestForm.paramType = data.paramType || 'params'
  requestForm.queryParams = data.queryParams?.length ? data.queryParams : [{ key: '', value: '' }]
  requestForm.params = data.params || ''
  requestForm.formParams = data.formParams?.length ? data.formParams : [{ key: '', value: '' }]
  requestForm.textParams = data.textParams || ''

  // 加载环境选择
  if (data.environmentId) {
    // 确保环境存在再设置
    const envExists = environments.value.some(env => env.id === data.environmentId)
    currentEnvId.value = envExists ? data.environmentId : ''
  } else {
    currentEnvId.value = ''
  }

  // 恢复响应数据
  if (data.responseData) {
    responseData.value = data.responseData
    convertToTable(data.responseData)
    requestStats.totalCount = Array.isArray(data.responseData) ? data.responseData.length : 1
    requestStats.requestTime = data.requestTime || 0
  } else {
    responseData.value = ''
    tableData.value = []
    tableColumns.value = []
    requestStats.totalCount = 0
    requestStats.requestTime = 0
  }

  originalUrl.value = (requestForm.url || '').split('?')[0]
}

// 选择请求
const handleRequestSelect = async (id) => {
  if (!id) return
  
  // 先保存当前请求的状态
  if (currentRequestId.value) {
    await saveCurrentRequest()
  }
  
  // 清空响应数据
  responseData.value = ''
  tableData.value = []
  tableColumns.value = []
  
  // 切换到新请求
  currentRequestId.value = id
  const request = requestList.value.find(r => r.id === id)
  if (request) {
    loadRequest(request)
    originalUrl.value = (requestForm.url || '').split('?')[0]
  }
}

// 保存当前请求
const saveCurrentRequest = async () => {
  if (!currentRequestId.value) return
  
  const currentRequest = requestList.value.find(r => r.id === currentRequestId.value)
  if (!currentRequest) return

  try {
    const data = {
      method: requestForm.method || 'GET',
      url: requestForm.url || '',
      headers: requestForm.headers?.length ? requestForm.headers.map(h => ({
        key: h.key || '',
        value: h.value || '',
        isCustomContentType: !!h.isCustomContentType
      })) : [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'Authorization', value: '' },
        { key: '', value: '' }
      ],
      paramType: requestForm.paramType || 'params',
      queryParams: requestForm.queryParams?.length
        ? requestForm.queryParams.map(p => ({
            key: p.key || '',
            value: p.value || ''
          }))
        : [{ key: '', value: '' }],
      params: requestForm.params || '',
      formParams: requestForm.formParams?.length
        ? requestForm.formParams.map(p => ({
            key: p.key || '',
            value: p.value || '',
            type: p.type || 'Text'
            // 不保存 files 字段
          }))
        : [{ key: '', value: '', type: 'Text' }],
      textParams: requestForm.textParams || '',
      environmentId: currentEnvId.value // 添加环境ID
    }

    // 处理响应数据，确保它是可序列化的
    if (responseData.value !== null && responseData.value !== undefined) {
      try {
        // 尝试序列化和反序列化以验证数据的可序列化性
        const serializedResponse = JSON.stringify(responseData.value)
        const parsedResponse = JSON.parse(serializedResponse)
        data.responseData = parsedResponse
        data.requestTime = requestStats.requestTime
      } catch (e) {
        console.warn('响应数据无法序列化，将不保存响应数据:', e)
        data.responseData = null
        data.requestTime = 0
      }
    }

    // 确保存储的数据是纯粹的对象
    const dbData = {
      _id: `request_${currentRequestId.value}`,
      name: currentRequest.name,
      data: data
    }
    
    // 先尝试获取现有文档
    const existingDoc = window.utools.db.get(`request_${currentRequestId.value}`)
    if (existingDoc && existingDoc._rev) {
      dbData._rev = existingDoc._rev
    }
    
    // 验证数据是否可序列化
    JSON.stringify(dbData)
    
    const result = await window.utools.db.put(dbData)
    
    if (result.ok) {
      // 更新内存中的数据
      const index = requestList.value.findIndex(r => r.id === currentRequestId.value)
      if (index !== -1) {
        requestList.value[index] = {
          ...requestList.value[index],
          data: data,
          _rev: result.rev
        }
      }
    } else {
      throw new Error('数据库保存失败')
    }
  } catch (error) {
    console.error('保存请求失败:', error)
    ElMessage.error(`保存请求失败: ${error.message}`)
  }
}

// 开始编辑名称
const startEditingName = (request) => {
  request.isEditing = true
}

// 保存请求名称
const saveRequestName = (request) => {
  request.isEditing = false
  saveCurrentRequest()
}

// 删除请求
const deleteRequest = (request) => {
  ElMessageBox.confirm('确定要删除这个请求吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    window.utools.db.remove(`request_${request.id}`)
    const index = requestList.value.findIndex(r => r.id === request.id)
    if (index > -1) {
      requestList.value.splice(index, 1)
    }
    if (currentRequestId.value === request.id) {
      currentRequestId.value = requestList.value[0]?.id || ''
      if (currentRequestId.value) {
        loadRequest(requestList.value[0])
      }
    }
  }).catch(() => {
    // 用户取消删除操作，不做任何处理
  })
}

// 复制请求
const copyRequest = async (request) => {
  const newId = Date.now().toString()
  // 深拷贝请求数据
  const newData = JSON.parse(JSON.stringify(request.data))
  // 新请求名
  const newName = request.name + ' - 复制'
  const newRequest = {
    id: newId,
    name: newName,
    data: newData,
    isEditing: false,
    selected: false
  }
  // 保存到数据库
  const dbData = {
    _id: `request_${newId}`,
    name: newName,
    data: newData
  }
  try {
    const result = await window.utools.db.put(dbData)
    if (result.ok) {
      newRequest._rev = result.rev
      requestList.value.push(newRequest)
      ElMessage.success('请求已复制')
    } else {
      throw new Error('复制请求失败')
    }
  } catch (error) {
    console.error('复制请求失败:', error)
    ElMessage.error(`复制请求失败: ${error.message}`)
  }
}

// 设置相关
const settingsVisible = ref(false)
const envDialogVisible = ref(false)
const envDialogType = ref('create')
const environments = ref([])
const currentEnvironment = ref({
  name: '',
  description: '',
  variables: []
})

// 显示设置对话框
const showSettings = () => {
  settingsVisible.value = true
  loadEnvironments()
}

// 加载环境变量
const loadEnvironments = () => {
  try {
    const envs = window.utools.db.allDocs('environment_')
    environments.value = envs.map(doc => ({
      id: doc._id.replace('environment_', ''),
      name: doc.name,
      description: doc.description,
      variables: doc.variables || []
    }))
  } catch (error) {
    console.error('加载环境列表失败:', error)
    environments.value = []
  }
}

// 创建新环境
const createEnvironment = () => {
  envDialogType.value = 'create'
  currentEnvironment.value = {
    name: '',
    description: '',
    variables: [
      { key: 'domain', value: '' },
      { key: 'token', value: '' }
    ]
  }
  envDialogVisible.value = true
}

// 编辑环境
const editEnvironment = (env) => {
  envDialogType.value = 'edit'
  currentEnvironment.value = {
    id: env.id,
    name: env.name,
    description: env.description,
    variables: env.variables.length > 0 ? [...env.variables] : [
      { key: 'domain', value: '' },
      { key: 'token', value: '' }
    ]
  }
  envDialogVisible.value = true
}

// 删除环境
const deleteEnvironment = (env) => {
  ElMessageBox.confirm('确定要删除这个环境吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    window.utools.db.remove(`environment_${env.id}`)
    loadEnvironments()
    ElMessage.success('删除成功')
  })
}

// 添加变量
const addVariable = () => {
  currentEnvironment.value.variables.push({
    key: '',
    value: ''
  })
}

// 删除变量
const removeVariable = (index) => {
  currentEnvironment.value.variables.splice(index, 1)
}

// 保存环境
const saveEnvironment = async () => {
  if (!currentEnvironment.value.name) {
    ElMessage.warning('请输入环境名称')
    return
  }

  try {
    // 确保变量数据可以被序列化
    const variables = currentEnvironment.value.variables.map(v => ({
      key: String(v.key || ''),
      value: String(v.value || '')
    }))

    const envData = {
      name: String(currentEnvironment.value.name),
      description: String(currentEnvironment.value.description || ''),
      variables: variables
    }

    if (envDialogType.value === 'create') {
      const id = Date.now().toString()
      const result = await window.utools.db.put({
        _id: `environment_${id}`,
        ...envData
      })
      if (!result.ok) {
        throw new Error('创建环境失败')
      }
    } else {
      const existingDoc = window.utools.db.get(`environment_${currentEnvironment.value.id}`)
      const result = await window.utools.db.put({
        _id: `environment_${currentEnvironment.value.id}`,
        _rev: existingDoc._rev,
        ...envData
      })
      if (!result.ok) {
        throw new Error('更新环境失败')
      }
    }
    
    envDialogVisible.value = false
    loadEnvironments() // 重新加载环境列表
    ElMessage.success(envDialogType.value === 'create' ? '创建成功' : '更新成功')
  } catch (error) {
    console.error('保存环境失败:', error)
    ElMessage.error(`保存环境失败: ${error.message}`)
  }
}

// 获取当前环境的变量提示
const getVariableSuggestions = () => {
  const currentEnv = environments.value.find(env => env.id === currentEnvironment.value?.id)
  if (!currentEnv) return []
  return currentEnv.variables.map(v => ({
    value: `{{${v.key}}}`,
    label: `${v.key} (${v.value})`
  }))
}

// 替换变量
const replaceVariables = (text) => {
  if (!text) return text
  const currentEnv = environments.value.find(env => env.id === currentEnvironment.value?.id)
  if (!currentEnv) return text
  
  let result = text
  currentEnv.variables.forEach(variable => {
    const regex = new RegExp(`{{${variable.key}}}`, 'g')
    result = result.replace(regex, variable.value)
  })
  return result
}

// 解析 URL 中的变量
const parseUrlWithVariables = (text) => {
  if (!text) return []
  const regex = /({{.*?}})|([^{]+)|({[^{].*?})/g
  const parts = []
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match[1]) { // 变量
      parts.push({ type: 'variable', text: match[1] })
    } else if (match[2] || match[3]) { // 普通文本
      parts.push({ type: 'text', text: match[2] || match[3] })
    }
  }

  return parts
}

// 处理 URL 输入
const handleUrlInput = () => {
  // 实现处理 URL 输入的逻辑
}

// 添加变量高亮处理函数
const highlightVariables = (text) => {
  if (!text) return text
  const regex = /{{.*?}}/g
  const matches = text.match(regex)
  if (!matches) return text

  const parts = text.split(regex)
  const result = []
  
  parts.forEach((part, index) => {
    if (part) {
      result.push(part)
    }
    if (matches[index]) {
      result.push(h('span', {
        style: {
          color: '#409EFF',
          backgroundColor: '#ecf5ff',
          padding: '0 4px',
          borderRadius: '4px',
          margin: '0 2px'
        }
      }, matches[index]))
    }
  })
  
  
  return result
}

// 添加当前环境ID
const currentEnvId = ref('')

// 处理环境变更
const handleEnvironmentChange = (envId) => {
  if (!envId) {
    currentEnvId.value = ''
    return
  }
  
  const selectedEnv = environments.value.find(env => env.id === envId)
  if (!selectedEnv) {
    currentEnvId.value = ''
    return
  }

  // 查找 domain 变量
  const domainVar = selectedEnv.variables.find(v => v.key === 'domain')
  if (domainVar && domainVar.value) {
    // 如果 URL 中已经有 domain 变量，替换它
    if (requestForm.url.includes('{{domain}}')) {
      requestForm.url = requestForm.url.replace('{{domain}}', domainVar.value)
    } else {
      // 否则，将 domain 值设置为新的 URL
      requestForm.url = domainVar.value
    }
  }

  // 查找 token 变量
  const tokenVar = selectedEnv.variables.find(v => v.key === 'token')
  if (tokenVar) {
    // 查找或创建 Authorization header
    let authHeader = requestForm.headers.find(h => h.key.toLowerCase() === 'authorization')
    if (!authHeader) {
      authHeader = { key: 'Authorization', value: '' }
      requestForm.headers.push(authHeader)
    }
    // 设置 token 值
    authHeader.value = tokenVar.value
  }

  // 保存当前请求
  saveCurrentRequest()
}

// 拖拽结束后保存顺序（如需持久化顺序可在此实现）
const saveRequestOrder = async () => {
  try {
    // 只保存顺序，不做其他副作用
    // 可选：将顺序保存到本地数据库
    // 例如：window.utools.db.put({_id: 'request_order', order: requestList.value.map(r => r.id)})
    // 这里只做内存顺序更新，避免频繁写入
  } catch (error) {
    console.error('保存请求顺序失败:', error)
  }
}

// 处理文件选择，支持多文件
const handleFormFileChange = (file, fileList, index) => {
  requestForm.formParams[index].files = fileList.map(f => f.raw)
  // value 字段用于显示文件名（可选）
  requestForm.formParams[index].value = fileList.map(f => f.name).join(', ')
}

// 移除单个文件
const removeFormFile = (paramIdx, fileIdx) => {
  const files = requestForm.formParams[paramIdx].files
  files.splice(fileIdx, 1)
  requestForm.formParams[paramIdx].files = [...files]
  requestForm.formParams[paramIdx].value = files.map(f => f.name).join(', ')
}

// 监听 paramType 变化，自动设置 Content-Type
watch(() => requestForm.paramType, (newType) => {
  if (newType === 'form') {
    // 查找 Content-Type header
    let ctHeader = requestForm.headers.find(h => h.key.toLowerCase() === 'content-type')
    if (!ctHeader) {
      ctHeader = { key: 'Content-Type', value: 'multipart/form-data' }
      requestForm.headers.push(ctHeader)
    } else {
      ctHeader.value = 'multipart/form-data'
    }
  } else if (newType === 'json') {
    // 可选：切回 json 时自动恢复
    let ctHeader = requestForm.headers.find(h => h.key.toLowerCase() === 'content-type')
    if (ctHeader) ctHeader.value = 'application/json'
  }
})
</script>

<style>
.app-container {
  height: 100vh;
  display: flex;
  overflow: hidden;
}

/* 左侧请求列表样式 */
.request-list-aside {
  width: 250px;
  flex-shrink: 0;
  background-color: #f5f7fa;
  border-right: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.aside-header {
  padding: 12px;
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.request-menu {
  flex: 1;
  overflow-y: auto;
  border-right: none;
}

/* 右侧主内容区样式 */
.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* 请求参数区域样式 */
.request-section {
  padding: 16px;
  background-color: #fff;
  border-bottom: 1px solid #e4e7ed;
  height: 50%;
  min-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.url-bar {
  margin-bottom: 16px;
}

.url-input-group {
  display: flex;
  gap: 12px;
  align-items: center;
}

.env-select {
  width: 140px !important;
  flex-shrink: 0;
}

.env-select :deep(.el-input__wrapper) {
  border-radius: 4px;
  background-color: var(--el-fill-color-blank);
}

.env-select :deep(.el-input__inner) {
  color: var(--el-color-success);
  font-weight: 500;
}

.url-input-wrapper {
  flex: 1;
  display: flex;
}

.method-select {
  width: 110px !important;
}

.url-input {
  width: 100%;
}

.url-input :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
}

.send-button {
  width: 100px;
  flex-shrink: 0;
}

.request-tabs {
  margin-bottom: 16px;
  border-bottom: 1px solid #e4e7ed;
}

.request-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.headers-container,
.body-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0;
}

.param-type-selector {
  margin-bottom: 16px;
}

.header-row,
.form-param-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.header-key,
.header-value,
.param-key,
.param-value {
  flex: 1;
}

.header-actions,
.param-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.param-textarea {
  font-family: monospace;
}

/* 响应数据区域样式 */
.response-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  overflow: hidden;
}

.response-header {
  padding: 8px 16px;
  border-bottom: 1px solid #e4e7ed;
  background-color: #f5f7fa;
}

.response-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.json-container,
.table-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: auto;
  padding: 16px;
}

.json-editor {
  height: 100%;
  min-height: 200px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: var(--el-fill-color-blank);
}

.json-error {
  margin-top: 8px;
  color: var(--el-color-danger);
  font-size: 14px;
}

/* 表单项样式 */
.header-row,
.form-param-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.header-key,
.header-value,
.param-key,
.param-value {
  flex: 1;
}

.header-actions,
.param-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.param-textarea {
  font-family: monospace;
}

/* 响应操作区样式 */
.response-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  margin-top: 8px;
}

.response-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #606266;
}

.response-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 请求列表项样式 */
.request-item-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  width: 100%;
  height: 40px;
}

.request-name {
  flex: 1;
  overflow: hidden;
  margin-right: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.request-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.request-name:hover {
  background-color: var(--el-fill-color-light);
}

.edit-icon {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  opacity: 0;
  transition: opacity 0.2s;
  cursor: pointer;
}

.edit-icon:hover {
  color: var(--el-color-primary);
}

.request-name:hover .edit-icon {
  opacity: 1;
}

.request-item-content :deep(.el-input) {
  margin: -4px 0;
}

.request-item-content :deep(.el-input__wrapper) {
  box-shadow: none;
  border: 1px solid var(--el-border-color);
}

.request-item-content :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.request-item-content :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.delete-btn {
  width: 22px;
  height: 22px;
  min-width: 22px;
  min-height: 22px;
  padding: 0;
  background: #f5f7fa;
  border: none;
  box-shadow: none;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.delete-btn:hover {
  background: #faeaea;
}
.delete-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}

.request-menu-item {
  padding: 0 8px !important;
}

.request-menu-item :deep(.el-menu-item) {
  padding: 0;
}

/* 滚动条美化 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 3px;
}

::-webkit-scrollbar-track {
  background: #f5f7fa;
}

/* 响应式布局 */
@media screen and (max-width: 768px) {
  .request-list-aside {
    width: 200px;
  }

  .url-bar {
    flex-direction: column;
  }

  .method-select,
  .send-button {
    width: 100% !important;
  }

  .header-row,
  .form-param-row {
    flex-direction: column;
  }

  .header-actions,
  .param-actions {
    justify-content: flex-end;
    margin-top: 8px;
  }
}

.header-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.add-header-row {
  margin-top: 8px;
  padding-left: calc(66.67% + 16px); /* 两个输入框的宽度加上间距 */
  display: flex;
  justify-content: flex-end;
}

.icon-button {
  padding: 6px;
  font-size: 14px;
}

.icon-button :deep(.el-icon) {
  margin: 0;
}

.form-param-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: flex-start;
}

.param-file-upload {
  display: inline-block;
  margin-right: 0;
}
.file-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}
.file-list-item {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 2px 8px;
  display: flex;
  align-items: center;
  font-size: 12px;
  width: 100%;
  box-sizing: border-box;
}
.file-name {
  margin-right: 4px;
  color: #606266;
}
.file-remove {
  color: #f56c6c;
  cursor: pointer;
  font-size: 14px;
}
.file-remove:hover {
  color: #d9001b;
}
.add-param-row {
  margin-top: 8px;
  padding-left: calc(66.67% + 16px);
  display: flex;
  justify-content: flex-end;
}
.empty-table {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--el-fill-color-blank);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}
.settings-button {
  margin-left: 8px;
}
.environments-header {
  margin-bottom: 20px;
}
.variable-item {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
  flex-wrap: wrap;
  width: 100%;
}
.variable-item .el-input {
  flex: 1;
  min-width: 200px;
  max-width: calc(50% - 24px); /* 减去间距和删除按钮的宽度 */
}
.variable-item .el-button {
  flex-shrink: 0;
}
/* 环境变量对话框样式 */
.el-dialog__body {
  max-height: 60vh;
  overflow-y: auto;
}
.el-form-item__content {
  flex-wrap: wrap;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* 变量高亮样式 */
.variable-highlight {
  color: #409EFF;
  background-color: #ecf5ff;
  padding: 0 4px;
  border-radius: 4px;
  margin: 0 2px;
}
.url-input-wrapper {
  flex: 1;
  display: flex;
}
.url-input {
  width: 100%;
}
.url-input :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
}
.url-input :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-border-color-hover) inset;
}
.url-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}
.url-input-content {
  display: inline-block;
  width: 100%;
  min-height: 32px;
  line-height: 32px;
  font-family: monospace;
}
.method-select {
  width: 110px !important;
}
/* 环境选择下拉框样式 */
.env-select {
  width: 140px !important;
  flex-shrink: 0;
}
.env-select :deep(.el-input__wrapper) {
  border-radius: 4px;
  background-color: var(--el-fill-color-blank);
}
.env-select :deep(.el-input__inner) {
  color: var(--el-color-success);
  font-weight: 500;
}
/* 调整 URL 输入框样式 */
.url-input :deep(.el-input__prepend) {
  padding: 0;
  background-color: transparent;
}
.url-input :deep(.el-select) {
  margin: 0;
}
.url-input :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
}
.copy-btn {
  width: 22px;
  height: 22px;
  min-width: 22px;
  min-height: 22px;
  padding: 0;
  background: #f5f7fa;
  border: none;
  box-shadow: none;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}
.copy-btn:hover {
  background: #e6f0fa;
}
.copy-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
}
.drag-ghost {
  opacity: 0.5;
  background: #e6f7ff !important;
}
.drag-chosen {
  background: #f0f9eb !important;
}
.drag-dragging {
  background: #f5f7fa !important;
}
.request-item-content .copy-btn,
.request-item-content .delete-btn {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}
.request-item-content:hover .copy-btn,
.request-item-content:hover .delete-btn {
  opacity: 1;
  pointer-events: auto;
}
.param-type-select {
  min-width: 60px;
  max-width: 80px;
}
.param-file-upload {
  display: inline-block;
  margin-right: 8px;
}
.file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.file-list-item {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 2px 8px;
  display: flex;
  align-items: center;
  font-size: 12px;
}
.file-name {
  margin-right: 4px;
  color: #606266;
}
.file-remove {
  color: #f56c6c;
  cursor: pointer;
  font-size: 14px;
}
.file-remove:hover {
  color: #d9001b;
}
</style>
