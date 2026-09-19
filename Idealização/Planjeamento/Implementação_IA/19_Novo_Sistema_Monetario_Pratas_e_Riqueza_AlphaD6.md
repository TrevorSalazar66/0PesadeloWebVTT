# Planejamento: Novo Sistema Monetário em Pratas (P) e Níveis de Riqueza (AlphaD6)

> [!NOTE]
> Este documento oficializa a padronização monetária do sistema **AlphaD6**, onde todas as transações, custos de itens e patrimônios são medidos em **Moedas de Prata (P)**. O valor inicial em Pratas e a posse de patrimônio são calculados a partir da soma dos atributos de intelecto e influência social: **$\text{Mente} + \text{Social}$**.

---

## 1. Escala dos 5 Níveis Monetários

A tabela abaixo define os **5 Níveis Monetários canônicos**, o cálculo de dinheiro inicial na criação da ficha e o patrimônio correspondente:

| Nível Monetário | Faixa $\text{Mente} + \text{Social}$ | Dinheiro Inicial | Nível | Patrimônio Básico | Descrição Narrativa |
| :--- | :---: | :---: | :---: | :--- | :--- |
| **Miserável** | $2 \text{ a } 3$ | **$1.200$ Pratas** | Tier 1 | Nenhum. | Uma pessoa que não possui patrimônio algum, muitas vezes se abrigando em estruturas sem uso para não ficar exposto à chuva e vento. A classe social mais baixa na escala monetária. |
| **Pobre** | $4 \text{ a } 5$ | **$2.500$ Pratas** | Tier 2 | Alguns utensílios domésticos e parte de uma casa, provavelmente um quarto próprio. | Uma pessoa com renda mensal baixa, comumente morando junto com outras pessoas desta classe social que se ajudam a manter o local alugado, nada mais que a escala monetária mínima para sobreviver. |
| **Abastado** | $6 \text{ a } 7$ | **$5.500$ Pratas** | Tier 3 | Casa própria/apartamento, veículos e equipamentos variados. | Uma pessoa com uma fonte de renda estável, possuindo uma casa própria ou talvez até mesmo um apartamento espaçoso, um veículo e com certa liberdade financeira. |
| **Rico** | $8 \text{ a } 9$ | **$8.500$ Pratas** | Tier 4 | Casas, veículos, terrenos, etc. | Uma pessoa com renda mensal significativamente maior que a média, com liberdade financeira e muitos bens compondo seu patrimônio. |
| **Milionário** | $\ge 10$ | **$12.500$ Pratas** | Tier 5 | Casas de luxo, veículos de luxo, equipamentos variados, terrenos, empresas, etc. | Uma pessoa com renda estável muito maior que todos, a maior classe na escala monetária, provavelmente dono de várias empresas e com incontáveis coisas compondo seu patrimônio. |

---

## 2. Aplicação na Ficha de Personagem

O objeto `riqueza` gerado na ficha canônica é estruturado da seguinte forma:

```json
{
  "id": "abastado",
  "label": "Abastado",
  "nivel": 3,
  "somaMenteSocial": 6,
  "dinheiroPrataInicial": 5500,
  "dinheiroPrataAtual": 5500,
  "patrimonio": "Casa, Veículos, Equipamentos variados.",
  "descricao": "Uma pessoa com uma fonte de renda estável, possuindo uma casa própria ou talvez até mesmo um apartamento espaçoso, um veículo e com certa liberdade financeira."
}
```

---

## 3. Padronização de Custos de Itens em Pratas (P)

Todos os itens do compêndio possuem um custo explícito em Pratas ($P$):
- **Consumíveis e Itens Utilitários Básicos**: de $20P$ a $150P$.
- **Armas Brancas Simples e Disparo**: de $15P$ a $350P$.
- **Armas de Fogo e Balística**: de $120P$ a $1.200P$.
- **Proteções Pessoais (Escudos e Armaduras)**: de $250P$ a $1.500P$.
- **Focos Arcanos e Artefatos Mágicos**: de $600P$ a $1.000P$.
- **Kits de Especialização (12 usos)**: $300P$.
