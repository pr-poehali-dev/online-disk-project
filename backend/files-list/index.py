import json
import os
import psycopg2


def get_user_id(event: dict) -> str | None:
    token = (event.get('headers') or {}).get('X-Authorization', '')
    if token.startswith('Bearer '):
        parts = token[7:].split(':')
        if len(parts) == 2:
            return parts[0]
    return None


def handler(event: dict, context) -> dict:
    """Возвращает список файлов текущего авторизованного пользователя."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    user_id = get_user_id(event)
    if not user_id:
        return {'statusCode': 401, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Требуется авторизация'})}

    schema = os.environ['MAIN_DB_SCHEMA']
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(
        f"SELECT id, original_name, size, mime_type, shared, share_token, created_at FROM {schema}.files WHERE user_id = %s ORDER BY created_at DESC",
        (user_id,)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    files = []
    for row in rows:
        files.append({
            'id': str(row[0]),
            'name': row[1],
            'size': row[2],
            'mime_type': row[3],
            'shared': row[4],
            'share_token': row[5],
            'created_at': row[6].isoformat()
        })

    return {
        'statusCode': 200,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'files': files})
    }
