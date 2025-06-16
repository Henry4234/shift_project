from flask import Flask, jsonify
from flask_cors import CORS
import subprocess
import json
import os
from cpmodel_2025 import main as run_schedule_model

app = Flask(__name__)
CORS(app)  # 啟用 CORS 以允許前端訪問

@app.route('/api/run-schedule', methods=['POST'])
def run_schedule():
    try:
        # 直接執行排班模型
        result = run_schedule_model()
        
        if result['status'] == 'success':
            return jsonify({
                'status': 'success',
                'message': result['message'],
                'data': {
                    'schedules': result['schedules'],
                    'penalty': result['penalty']
                }
            })
        else:
            return jsonify({
                'status': 'error',
                'message': result['message'],
                'data': {
                    'violations': result.get('violations', {}),
                    'diagnostic_info': result.get('diagnostic_info', {})
                }
            }), 500
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'發生錯誤：{str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000) 