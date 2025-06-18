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

// API 端點來更新員工班別數量
app.post('/api/employee-amount/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const shiftRequirements = req.body;  // 預期格式: { A: 數量, B: 數量, C: 數量 }

    console.log(`更新員工 ${employeeId} 的班別需求...`);
    console.log('更新資料：', shiftRequirements);

    const updates = [];

    // 處理每個班別的更新
    for (const [shift_type, required_days] of Object.entries(shiftRequirements)) {
      // 檢查是否已存在該班別的記錄
      const { data: existing, error: checkError } = await supabase
        .from('shift_requirements')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('shift_type', shift_type)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      let result;
      if (existing) {
        // 更新現有記錄
        const { data, error: updateError } = await supabase
          .from('shift_requirements')
          .update({ required_days })
          .eq('employee_id', employeeId)
          .eq('shift_type', shift_type)
          .select();

        if (updateError) throw updateError;
        result = data;
      } else {
        // 創建新記錄
        const { data, error: insertError } = await supabase
          .from('shift_requirements')
          .insert({
            employee_id: employeeId,
            shift_type,
            required_days
          })
          .select();

        if (insertError) throw insertError;
        result = data;
      }

      updates.push(...result);
    }

    console.log('更新成功：', updates);
    res.json(updates);
  } catch (err) {
    console.error('更新班別需求時發生錯誤：', err.message);
    res.status(500).json({ error: '無法更新班別需求' });
  }
});

// API 端點來新增員工
app.post('/api/employees', async (req, res) => {
  try {
    const { name, shift_requirements, preferences } = req.body;

    // 驗證姓名
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: '請輸入有效的員工姓名' });
    }

    // 驗證班別天數
    const validateShiftDays = (days) => {
      const num = parseInt(days);
      return !isNaN(num) && num >= 0 && num <= 30 && Number.isInteger(num);
    };

    if (!validateShiftDays(shift_requirements.A) || 
        !validateShiftDays(shift_requirements.B) || 
        !validateShiftDays(shift_requirements.C)) {
      return res.status(400).json({ error: '班別天數必須是 0-30 之間的整數' });
    }

    console.log('開始新增員工...');
    console.log('新增資料：', req.body);

    // 1. 新增員工基本資料
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .insert({ name: name.trim() })
      .select('id')
      .single();

    if (employeeError) throw employeeError;

    // 使用 Promise.all 並行處理偏好設定和班別需求
    const [prefResult, shiftResult] = await Promise.all([
      // 新增員工偏好設定
      supabase
        .from('employee_preferences')
        .insert({
          employee_id: employee.id,
          max_continuous_days: preferences.max_continuous_days,
          continuous_c: preferences.continuous_c,
          double_off_after_c: preferences.double_off_after_c
        }),

      // 新增班別需求
      supabase
        .from('shift_requirements')
        .insert([
          { employee_id: employee.id, shift_type: 'A', required_days: shift_requirements.A },
          { employee_id: employee.id, shift_type: 'B', required_days: shift_requirements.B },
          { employee_id: employee.id, shift_type: 'C', required_days: shift_requirements.C }
        ])
    ]);

    if (prefResult.error) throw prefResult.error;
    if (shiftResult.error) throw shiftResult.error;

    console.log('新增員工成功：', employee);
    res.json(employee);
  } catch (err) {
    console.error('新增員工時發生錯誤：', err.message);
    res.status(500).json({ error: '無法新增員工' });
  }
});

app.listen(port, () => {
  console.log(`服務器運行在 http://localhost:${port}`);
});