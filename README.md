# ScrapSys

An Electron application with React

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Preview mobile

```bash
pnpm mobile:dev
```

Abra `http://localhost:5174` no preview mobile do VS Code. O servidor aceita tambem
acesso pela rede local, usando o IP do PC e a porta `5174`.

### Android

Requer Node.js 22+, Android Studio, Android SDK e JDK 21 configurados. Na primeira vez:

```bash
pnpm install
pnpm android:add
pnpm android:open
```

Depois de cada alteracao web, `pnpm android:sync` atualiza o projeto nativo. O
Electron continua usando `pnpm dev` e busca atualizacoes nos Releases do GitHub.
No Android pessoal, publique o APK release assinado e instale-o sobre a versao
anterior; use sempre a mesma chave para preservar os dados.

### Sincronizacao gratuita PC e Android

Em `Configuracoes > Sincronizacao PC e Mobile`, exporte o backup no dispositivo
mais atualizado e importe o arquivo JSON no outro. A importacao substitui os dados
locais e transfere usuarios, sucatas, compras, caixa, fornecedores e equipamentos.
O arquivo contem dados de acesso e deve ser guardado em local privado.

### Assinatura Android

O build release usa `android/keystore.properties`, que nao deve ser enviado ao Git.
A chave indicada nesse arquivo precisa ser preservada para instalar atualizacoes
sobre a mesma aplicacao sem apagar os dados.

### Build

```bash
# For windows
pnpm build:win

# For macOS
pnpm build:mac

# For Linux
pnpm build:linux
```
