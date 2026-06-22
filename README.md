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

Com o ScrapSys aberto no PC, acesse `Configuracoes > Sincronizacao PC e Mobile`.
No Android, informe um dos enderecos exibidos no PC e o codigo de pareamento de
seis digitos. Os dois dispositivos devem estar na mesma rede Wi-Fi ou local.

Depois do pareamento, usuarios, sucatas, compras, caixa, fornecedores e
configuracoes sao sincronizados automaticamente nos dois sentidos. No primeiro
uso, permita o acesso do ScrapSys a redes privadas no Firewall do Windows.

A exportacao e importacao de backup continuam disponiveis como recuperacao de
seguranca. O arquivo contem dados de acesso e deve ser guardado em local privado.

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
