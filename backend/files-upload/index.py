import json
import os
import base64
import uuid
import boto3
import psycopg2


def handler(event: dict, context) -> dict:
    """Загружает файл в S3 и сохраняет мета-данные в БД."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    file_data_b64 = body.get('file')
    original_name = body.get('name', 'file')
    mime_type = body.get('mime_type', 'application/octet-stream')

    if not file_data_b64:
        return {'statusCode': 400, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Файл не передан'})}

    file_bytes = base64.b64decode(file_data_b64)
    file_size = len(file_bytes)

    s3_key = f"amsdrive/{uuid.uuid4()}/{original_name}"

    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
    )
    s3.put_object(Bucket='files', Key=s3_key, Body=file_bytes, ContentType=mime_type)

    schema = os.environ['MAIN_DB_SCHEMA']
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {schema}.files (name, original_name, size, mime_type, s3_key) VALUES (%s, %s, %s, %s, %s) RETURNING id, created_at",
        (original_name, original_name, file_size, mime_type, s3_key)
    )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'id': str(row[0]),
            'name': original_name,
            'size': file_size,
            'mime_type': mime_type,
            'created_at': row[1].isoformat()
        })
    }
