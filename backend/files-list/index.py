import json
import os
import psycopg2


def handler(event: dict, context) -> dict:
    """Возвращает список всех файлов пользователя."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    schema = os.environ['MAIN_DB_SCHEMA']
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    cur.execute(
        f"SELECT id, original_name, size, mime_type, shared, share_token, created_at FROM {schema}.files ORDER BY created_at DESC"
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
