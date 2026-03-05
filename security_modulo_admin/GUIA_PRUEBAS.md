# Módulo de Seguridad — Guía de Pruebas

## Instalación y arranque

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env y asignar un JWT_SECRET seguro

# 3. Arrancar el servidor
npm run dev
# Salida esperada:
# ✓ Configuración de seguridad validada
# ✓ Servidor corriendo en http://localhost:3000
```

---

## HU-1: Autenticación Obligatoria

### Paso 1 — Acceder sin token (debe devolver 401)
```bash
curl -X GET http://localhost:3000/users/profile
# Esperado: 401 { "message": "Autenticación requerida" }
```

### Paso 2 — Registrar un usuario
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@test.com","password":"Password1"}'
# Esperado: 201 { "user": {...}, "token": "eyJ..." }
```

### Paso 3 — Login con credenciales válidas
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@test.com","password":"Password1"}'
# Esperado: 200 { "user": {...}, "token": "eyJ..." }
# Guardar el token para los siguientes pasos
```

### Paso 4 — Login con credenciales inválidas (debe devolver 401)
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@test.com","password":"WrongPassword1"}'
# Esperado: 401 { "message": "Credenciales inválidas" }
```

### Paso 5 — Acceder con token válido
```bash
TOKEN="pegar_token_del_paso_3"
curl -X GET http://localhost:3000/users/profile \
  -H "Authorization: Bearer $TOKEN"
# Esperado: 200 con datos del usuario (sin password)
```

---

## HU-2: Gestión de Credenciales

### Paso 1 — Registrar un usuario con email único
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"nuevo@test.com","password":"Password1"}'
# Esperado: 201 con el usuario creado
```

### Paso 2 — Intentar registrar el mismo email (debe fallar)
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"nuevo@test.com","password":"OtraPass1"}'
# Esperado: 400 { "message": "El correo ya está registrado" }
```

### Paso 3 — Registrar con email inválido (debe fallar)
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"no-es-un-email","password":"Password1"}'
# Esperado: 400 { "message": "Formato de correo inválido" }
```

---

## HU-3: Protección de Credenciales

### Paso 1 — Registrar y verificar que la respuesta no incluye password
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"seguro@test.com","password":"Password1"}'
# Verificar: el campo "password" NO debe aparecer en la respuesta
```

### Paso 2 — Verificar que el JWT no contiene la contraseña
```bash
# Tomar el token del paso anterior y decodificar su payload (base64)
# El payload es la segunda parte del token separada por puntos
TOKEN="eyJ......"
echo $TOKEN | cut -d'.' -f2 | base64 -d 2>/dev/null || \
  python3 -c "
import base64, sys
token = '$TOKEN'
payload = token.split('.')[1]
padded = payload + '=' * (4 - len(payload) % 4)
print(base64.b64decode(padded).decode())
"
# Verificar: el payload solo debe contener id, email, roles, iat, exp
# NO debe contener el campo password
```

### Paso 3 — Verificar que contraseñas débiles son rechazadas
```bash
# Sin mayúsculas
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"otro@test.com","password":"sinmayusculas1"}'
# Esperado: 400

# Sin números
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"otro@test.com","password":"SinNumeros"}'
# Esperado: 400

# Muy corta
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"otro@test.com","password":"Ab1"}'
# Esperado: 400
```

---

## HU-4: Control de Acceso Basado en Roles

### Paso 1 — Registrar un usuario normal (rol USER)
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"Password1"}'
# Guardar el token como TOKEN_USER
```

### Paso 2 — Registrar un administrador (rol ADMIN)
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"Password1","roles":["ADMIN"]}'
# Guardar el token como TOKEN_ADMIN
```

### Paso 3 — Usuario normal intenta listar usuarios (debe ser denegado)
```bash
TOKEN_USER="pegar_token_user"
curl -X GET http://localhost:3000/users \
  -H "Authorization: Bearer $TOKEN_USER"
# Esperado: 403 { "message": "Acceso denegado: rol insuficiente" }
```

### Paso 4 — Admin lista todos los usuarios (debe funcionar)
```bash
TOKEN_ADMIN="pegar_token_admin"
curl -X GET http://localhost:3000/users \
  -H "Authorization: Bearer $TOKEN_ADMIN"
# Esperado: 200 con array de usuarios
```

### Paso 5 — Admin consulta logs de acceso
```bash
curl -X GET http://localhost:3000/users/logs \
  -H "Authorization: Bearer $TOKEN_ADMIN"
# Esperado: 200 con historial de intentos de login/registro
```

### Paso 6 — Admin actualiza el rol de un usuario
```bash
# Primero obtener el ID del usuario desde GET /users
USER_ID="pegar_id_del_usuario"
curl -X PATCH http://localhost:3000/users/$USER_ID/roles \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"roles":["MODERATOR"]}'
# Esperado: 200 con el usuario actualizado
```

### Paso 7 — Usuario normal intenta acceder a logs (debe ser denegado)
```bash
curl -X GET http://localhost:3000/users/logs \
  -H "Authorization: Bearer $TOKEN_USER"
# Esperado: 403 { "message": "Acceso denegado: rol insuficiente" }
```
