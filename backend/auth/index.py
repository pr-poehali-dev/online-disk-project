import json
import os
import hashlib
import secrets
import psycopg2


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def handler(event: dict, context) -> dict:
    """Регистрация и вход пользователей. action=register|login."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400'}, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    action = body.get('action')
    email = (body.get('email') or '').strip().lower()
    password = body.get('password') or ''
    name = (body.get('name') or '').strip()

    if not email or not password:
        return {'statusCode': 400, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Email и пароль обязательны'})}

    schema = os.environ['MAIN_DB_SCHEMA']
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    if action == 'register':
        if not name:
            cur.close(); conn.close()
            return {'statusCode': 400, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Имя обязательно'})}

        cur.execute(f"SELECT id FROM {schema}.users WHERE email = %s", (email,))
        if cur.fetchone():
            cur.close(); conn.close()
            return {'statusCode': 409, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Пользователь с таким email уже существует'})}

        pw_hash = hash_password(password)
        token = secrets.token_hex(32)
        cur.execute(
            f"INSERT INTO {schema}.users (email, password_hash, name) VALUES (%s, %s, %s) RETURNING id",
            (email, pw_hash, name)
        )
        user_id = str(cur.fetchone()[0])
        conn.commit()
        cur.close(); conn.close()

        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'token': f"{user_id}:{token}", 'user': {'id': user_id, 'email': email, 'name': name}})
        }

    elif action == 'login':
        pw_hash = hash_password(password)
        cur.execute(
            f"SELECT id, email, name FROM {schema}.users WHERE email = %s AND password_hash = %s",
            (email, pw_hash)
        )
        row = cur.fetchone()
        cur.close(); conn.close()

        if not row:
            return {'statusCode': 401, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Неверный email или пароль'})}

        user_id = str(row[0])
        token = secrets.token_hex(32)
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'token': f"{user_id}:{token}", 'user': {'id': user_id, 'email': row[1], 'name': row[2]}})
        }

    cur.close(); conn.close()
    return {'statusCode': 400, 'headers': {'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Неизвестное действие'})}
