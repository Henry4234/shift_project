// main.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// 添加 JSON 解析中間件
app.use(express.json());

// 提供靜態文件
app.use(express.static(__dirname));

// 提供 index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API 端點來獲取員工數據
app.get('/api/employees', async (req, res) => {
  try {
    console.log('開始從 Supabase 獲取員工資料...');
    
    const { data: members, error } = await supabase
      .from('employees')
      .select('*');

    if (error) {
      console.error('Supabase 查詢錯誤：', error);
      throw error;
    }

    console.log('從 Supabase 獲取到的資料：', members);
    
    if (!members || members.length === 0) {
      console.log('警告：沒有找到任何員工資料');
    }

    res.json(members);
  } catch (err) {
    console.error('取得人員資料時發生錯誤：', err.message);
    res.status(500).json({ error: '無法載入人員資料' });
  }
});

// API 端點來獲取員工偏好設定
app.get('/api/employee-preferences', async (req, res) => {
  try {
    console.log('開始從 Supabase 獲取員工偏好設定...');
    
    const { data: preferences, error } = await supabase
      .from('employee_preferences')
      .select('*');

    if (error) {
      console.error('Supabase 查詢錯誤：', error);
      throw error;
    }

    console.log('從 Supabase 獲取到的員工偏好設定：', preferences);
    res.json(preferences);
  } catch (err) {
    console.error('取得員工偏好設定時發生錯誤：', err.message);
    res.status(500).json({ error: '無法載入員工偏好設定' });
  }
});

// API 端點來獲取班表需求
app.get('/api/shift-requirements', async (req, res) => {
  try {
    console.log('開始從 Supabase 獲取班表需求...');
    
    const { data: requirements, error } = await supabase
      .from('shift_requirements')
      .select('*');

    if (error) {
      console.error('Supabase 查詢錯誤：', error);
      throw error;
    }

    console.log('從 Supabase 獲取到的班表需求：', requirements);
    res.json(requirements);
  } catch (err) {
    console.error('取得班表需求時發生錯誤：', err.message);
    res.status(500).json({ error: '無法載入班表需求' });
  }
});

// API 端點來更新員工偏好設定
app.post('/api/employee-preferences/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { max_continuous_days, continuous_c, double_off_after_c } = req.body;

    console.log(`更新員工 ${employeeId} 的偏好設定...`);
    console.log('更新資料：', req.body);

    // 先檢查是否已存在偏好設定
    const { data: existingPref, error: checkError } = await supabase
      .from('employee_preferences')
      .select('id')
      .eq('employee_id', employeeId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 是找不到記錄的錯誤碼
      throw checkError;
    }

    let result;
    if (existingPref) {
      // 更新現有記錄
      const { data, error } = await supabase
        .from('employee_preferences')
        .update({
          max_continuous_days,
          continuous_c,
          double_off_after_c
        })
        .eq('employee_id', employeeId)
        .select();

      if (error) throw error;
      result = data;
    } else {
      // 創建新記錄
      const { data, error } = await supabase
        .from('employee_preferences')
        .insert({
          employee_id: employeeId,
          max_continuous_days,
          continuous_c,
          double_off_after_c
        })
        .select();

      if (error) throw error;
      result = data;
    }

    console.log('更新成功：', result);
    res.json(result);
  } catch (err) {
    console.error('更新員工偏好設定時發生錯誤：', err.message);
    res.status(500).json({ error: '無法更新員工偏好設定' });
  }
});

app.listen(port, () => {
  console.log(`服務器運行在 http://localhost:${port}`);
});