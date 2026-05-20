import json
import os
import base64
import boto3
import psycopg2


def get_user_id(event: dict) -> str | None:
    token = (event.get('headers') or {}).get('X-Authorization', '')
    if token.startswith('Bearer '):
        parts = token[7:].split(':')
        if len(parts) == 2:
            return parts[0]
    return None


def handler(event: dict, context) -> dict:
    """Возвращает файл из S3 в base64 для скачивания пользователем."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    user_id = get_user_id(event)
    if not user_id:
        return {'statusCode': 401, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Требуется авторизация'})}

    params = event.get('queryStringParameters') or {}
    file_id = params.get('id')

    if not file_id:
        return {'statusCode': 400, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'ID файла не передан'})}

    schema = os.environ['MAIN_DB_SCHEMA']
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(
        f"SELECT s3_key, original_name, mime_type FROM {schema}.files WHERE id = %s AND user_id = %s",
        (file_id, user_id)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return {'statusCode': 404, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Файл не найден'})}

    s3_key, original_name, mime_type = row

    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
    )
    obj = s3.get_object(Bucket='files', Key=s3_key)
    file_bytes = obj['Body'].read()
    file_b64 = base64.b64encode(file_bytes).decode('utf-8')

    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'file': file_b64,
            'name': original_name,
            'mime_type': mime_type
        })
    }
