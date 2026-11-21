# Roleta Russa: desenho

## Pra que serve
Jogo de festa num celular só, passando de mão em mão. Serve pra diversão numa roda de amigos e pra decidir coisas (quem paga a conta, quem lava a louça).

## Decisões do Pedro
- Uso: roda de amigos e decidir algo. Nada de multiplayer online.
- Regra do tambor: 1 bala em 6 câmaras, gira uma vez e não gira de novo. A chance do próximo tiro aumenta a cada clique vazio.
- Recursos: animação e som, vibração, eliminação até sobrar um, placar entre rodadas.
- Plataforma: app web instalável (adicionar à tela inicial), sem loja.

## Abordagens consideradas
- App web instalável com Vite + TypeScript (escolhida): link pronto, roda em Android e iPhone, sem conta de desenvolvedor.
- Expo / React Native: daria pra ir pra loja, mas exige mais setup e não muda nada no jogo.
- Flutter: mesmo ganho do Expo, com linguagem nova.

## Decisões minhas
- Dois modos, porque eliminação e "decidir quem paga" puxam pra lados diferentes: "Até sobrar um" (padrão) e "Um tiro decide".
- Na eliminação, a cada tiro o tambor é recarregado e girado de novo, e a vez passa pra quem estava depois do eliminado.
- Quem começa é sorteado.
- Placar por nome (sem diferenciar maiúscula): tiros levados, vitórias (só no modo eliminação) e jogos. Fica salvo no próprio celular.
- Sons gerados pelo navegador (Web Audio), sem arquivos de terceiros. Revólver desenhado em SVG.
- Vibração só funciona no Android. O Safari do iPhone não permite.
- Publicação no GitHub Pages via GitHub Actions.

## Fora do escopo
Multiplayer, contas, ranking online, publicação em loja.
