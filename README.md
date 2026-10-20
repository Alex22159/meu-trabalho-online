# Meu Trabalho — versão para várias pessoas

Projeto separado para testes online, com entrada em vidro fosco, cadastro com e-mail e senha, recuperação de senha e dados separados por conta. O aplicativo pessoal e seu banco local não foram copiados para este projeto.

## Estado atual

O aplicativo está conectado ao projeto Supabase `meu-trabalho-online` (`lxekbavenqlznpebotzl`). A migração foi executada e a verificação no banco confirmou RLS ativo, leitura anônima bloqueada e gravação somente pela operação autenticada. O cadastro por e-mail está habilitado com confirmação de e-mail. Falta testar contas reais e configurar o endereço definitivo do GitHub Pages e a entrega de e-mails antes de convidar outras pessoas.

O arquivo `supabase.public.json` contém somente a URL e a chave publicável, próprias para uso no navegador. O build utiliza esses valores automaticamente; variáveis de ambiente podem substituí-los. Nenhuma senha do banco ou chave administrativa está incluída.

## Configurar o novo Supabase

1. O projeto deste pacote já foi criado. Os passos abaixo também servem para instalar em outro projeto novo.
2. A migração `supabase/migrations/001_workspaces.sql` já foi executada neste projeto. Em outro projeto novo, execute-a no SQL Editor. Ela cria a estrutura, as regras de acesso e as operações de gravação. Não execute em outro projeto sem revisar os nomes.
3. Habilite o provedor de e-mail e senha em Authentication. Configure a Site URL e os Redirect URLs com o endereço final do GitHub Pages, incluindo a pasta do repositório e a barra final.
4. Para testar localmente, inclua também `http://127.0.0.1:5174/` entre os Redirect URLs.
5. Configure o envio de e-mail antes de convidar várias pessoas: a entrega de confirmações e recuperação depende da configuração e dos limites de e-mail do Supabase.
6. Para outro projeto, altere `supabase.public.json` ou copie `.env.example` para `.env.local` e preencha a URL e a chave **publicável**. Nunca use `service_role`, `sb_secret_`, senha do banco ou credenciais administrativas no frontend.

As funções do banco usam o usuário autenticado para determinar o dono dos registros. A tabela tem segurança por linha e não aceita gravação direta pelo frontend. A atualização usa revisão para evitar que dois aparelhos apaguem mudanças um do outro. O botão limpar atua somente nos dados da conta conectada.

## Abrir a prévia

Com Node.js 24 e dependências instaladas:

```sh
npm ci
npm run build
npm run preview
```

Abra o endereço local informado. O app pessoal permanece no seu endereço original.

## Publicar no GitHub Pages

1. Coloque somente o conteúdo desta pasta em um repositório novo. Não envie bancos locais, backups pessoais ou arquivos de ambiente.
2. A conexão pública já está incluída em `supabase.public.json`. Opcionalmente, em Settings → Secrets and variables → Actions → Variables, configure `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` para substituir esses valores.
3. Em Settings → Pages, escolha **GitHub Actions** como fonte.
4. Envie o código para `main`. O fluxo já incluído testa, compila e publica. A publicação é bloqueada se faltar a configuração do Supabase.
5. Antes de convidar pessoas, teste duas contas reais: cada uma deve ver apenas seus registros. Teste também entrada, saída, confirmação de e-mail, recuperação de senha e o mesmo usuário em dois aparelhos.

O código não foi enviado ao GitHub e não há URL pública verificada ainda. Os testes automatizados de integração verificam isolamento de contas, privilégios, revisão de gravação e validação dos registros. Ainda é necessário validar cadastro, confirmação, recuperação e uso simultâneo com contas reais.
