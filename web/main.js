// main.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from './supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

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

app.listen(port, () => {
  console.log(`服務器運行在 http://localhost:${port}`);
});