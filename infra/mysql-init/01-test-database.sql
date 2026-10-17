-- Cria o banco exclusivo dos testes de integração e concede acesso ao usuário da aplicação.
-- Os testes da API recusam rodar em bancos cujo nome não termina em "_test".
CREATE DATABASE IF NOT EXISTS autoescola_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON autoescola_test.* TO 'autoescola'@'%';
FLUSH PRIVILEGES;
