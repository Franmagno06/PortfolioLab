/**
 * "O que é este ativo": a explicação de duas ou três frases que abre a ficha, para quem nunca ouviu
 * falar da empresa ou do fundo. Escrita à mão, sem número que envelheça (faturamento, tamanho,
 * posição no ranking) e sem juízo de valor: diz o que o ativo faz, nunca se vale a pena (Resolução
 * CVM 20). Um teste confere que todo ticker do catálogo tem a sua.
 */
export const DESCRICOES: Record<string, string> = {
  // --- ações ---
  PETR4:
    "A Petrobras é a maior empresa de petróleo do Brasil, controlada pelo governo federal. Extrai petróleo e gás, principalmente em águas profundas, e refina e vende combustíveis. O resultado acompanha o preço do petróleo e o câmbio.",
  VALE3:
    "A Vale é uma das maiores mineradoras do mundo. Extrai minério de ferro, usado na fabricação de aço, e também níquel e cobre. Vende em dólar para clientes de vários países, e o resultado depende muito da demanda e do preço do minério.",
  ITUB4:
    "O Itaú Unibanco é o maior banco privado do Brasil. Oferece conta, cartão, crédito, seguros e investimentos a pessoas e empresas. Ganha principalmente com os juros do crédito e com tarifas de serviços.",
  BBDC4:
    "O Bradesco é um dos maiores bancos privados do Brasil, com atuação também em seguros e previdência. Ganha com os juros do crédito, com tarifas e com os prêmios de seguros.",
  BBAS3:
    "O Banco do Brasil é um banco controlado pelo governo federal e muito presente no crédito rural e no agronegócio. Atende pessoas e empresas e ganha principalmente com os juros do crédito.",
  ABEV3:
    "A Ambev fabrica e vende cervejas, refrigerantes e outras bebidas, como Skol, Brahma e Guaraná Antarctica. Vende para bares, mercados e distribuidores no Brasil e em outros países da América Latina e do Caribe.",
  WEGE3:
    "A WEG fabrica motores elétricos, geradores, transformadores e equipamentos de automação para a indústria e para a geração de energia. É uma empresa brasileira com fábricas e clientes em vários países.",
  B3SA3:
    "A B3 é a bolsa de valores do Brasil: o lugar onde se compram e vendem ações, fundos imobiliários, ETFs e contratos futuros. Ganha uma taxa sobre cada negociação e com serviços de registro e guarda de ativos.",
  SUZB3:
    "A Suzano produz celulose, matéria-prima do papel, e papéis como os usados em cadernos e embalagens. Planta as próprias florestas de eucalipto e vende principalmente para o exterior, em dólar.",
  AXIA3:
    "A Axia Energia é a antiga Eletrobras. Gera e transmite energia elétrica, com usinas hidrelétricas e linhas de transmissão espalhadas pelo país, e vende essa energia a distribuidoras e a grandes consumidores.",
  RENT3:
    "A Localiza aluga carros para pessoas e empresas, inclusive por assinatura, e depois vende os carros usados. Também aluga frotas para empresas.",
  CMIG4:
    "A Cemig é a companhia de energia de Minas Gerais, controlada pelo governo do estado. Gera energia elétrica, a transmite e a distribui para boa parte do estado. As tarifas de distribuição são reguladas pelo governo federal.",
  RADL3:
    "A RaiaDrogasil é a maior rede de farmácias do país, dona das marcas Raia e Drogasil. Vende medicamentos, produtos de higiene e de beleza em lojas físicas e pela internet.",
  EQTL3:
    "A Equatorial é uma empresa de energia elétrica que distribui energia em vários estados, principalmente no Norte e no Nordeste, e também atua em saneamento. As tarifas de distribuição são reguladas pelo governo federal.",
  TAEE11:
    "A Taesa transmite energia elétrica: é dona de linhas de transmissão que levam a energia das usinas até as distribuidoras. Recebe uma receita anual definida em contrato com o governo, e não depende de quanta energia passa pelas linhas. A Unit é um pacote de ações ordinárias e preferenciais negociado como um papel só.",

  // --- fundos imobiliários ---
  MXRF11:
    "Fundo de papel: aplica a maior parte do dinheiro em CRI, títulos de dívida lastreados em créditos imobiliários, e uma parte menor em imóveis e em cotas de outros fundos. O rendimento vem principalmente dos juros desses títulos.",
  HGLG11:
    "Fundo de tijolo que é dono de galpões logísticos, usados por empresas para guardar e distribuir mercadorias. O rendimento vem do aluguel desses galpões. É o antigo CSHG Logística, hoje gerido pela Pátria.",
  KNRI11:
    "Fundo de tijolo com lajes corporativas (prédios de escritórios) e galpões logísticos. O rendimento vem do aluguel pago pelas empresas que ocupam esses imóveis.",
  KNCR11:
    "Fundo de papel que aplica em CRI com rendimento ligado ao CDI, taxa que acompanha a Selic, a taxa básica de juros. O rendimento vem dos juros desses títulos e tende a acompanhar os juros da economia.",
  KNIP11:
    "Fundo de papel que aplica em CRI com rendimento ligado à inflação (IPCA) mais uma taxa fixa. O rendimento vem dos juros desses títulos e da correção pela inflação.",
  BTLG11:
    "Fundo de tijolo dono de galpões logísticos, alugados a empresas que guardam e distribuem mercadorias. O rendimento vem do aluguel.",
  XPLG11:
    "Fundo de tijolo dono de galpões logísticos, alugados a empresas que guardam e distribuem mercadorias. O rendimento vem do aluguel.",
  VISC11:
    "Fundo de tijolo dono de participações em shopping centers. O rendimento vem do aluguel pago pelas lojas e depende do movimento dos shoppings.",
  HGRE11:
    "Fundo de tijolo dono de lajes corporativas, prédios de escritórios alugados a empresas. O rendimento vem do aluguel. É o antigo CSHG Real Estate, hoje gerido pela Pátria.",
  KFOF11:
    "Fundo de fundos: em vez de ter imóveis diretamente, compra cotas de outros fundos imobiliários. O rendimento vem dos rendimentos que esses fundos pagam.",
  HGBS11:
    "Fundo de tijolo dono de participações em shopping centers. O rendimento vem do aluguel pago pelas lojas e depende do movimento dos shoppings.",
  VILG11:
    "Fundo de tijolo dono de galpões logísticos, alugados a empresas que guardam e distribuem mercadorias. O rendimento vem do aluguel.",
  XPSF11:
    "Fundo de fundos: compra cotas de outros fundos imobiliários, em vez de ter imóveis diretamente. O rendimento vem dos rendimentos que esses fundos pagam.",
  XPML11:
    "Fundo de tijolo dono de participações em shopping centers. O rendimento vem do aluguel pago pelas lojas e depende do movimento dos shoppings.",
  HGCR11:
    "Fundo de papel que aplica em CRI, títulos de dívida lastreados em créditos imobiliários. O rendimento vem dos juros desses títulos. É o antigo CSHG Recebíveis, hoje gerido pela Pátria.",

  // --- ETFs ---
  BOVA11:
    "ETF que copia o Ibovespa, o principal índice da bolsa brasileira, formado pelas ações mais negociadas. Ao comprar uma cota, você fica exposto a todas essas empresas de uma vez, na proporção do índice.",
  IVVB11:
    "ETF que copia o S&P 500, índice das 500 maiores empresas dos Estados Unidos. É negociado em reais na B3, mas o valor da cota acompanha as ações americanas e o dólar.",
  SMAL11:
    "ETF que copia o índice de empresas de menor porte da bolsa brasileira (small caps). Ao comprar uma cota, você fica exposto a várias dessas empresas de uma vez.",
  DIVO11:
    "ETF que copia o IDIV, índice formado pelas ações da bolsa brasileira que mais pagaram dividendos e juros sobre capital próprio. Ao comprar uma cota, você fica exposto a várias dessas empresas de uma vez.",
  B5P211:
    "ETF de renda fixa que copia um índice de títulos públicos do Tesouro atrelados à inflação (IPCA) com vencimento de até cinco anos. O valor da cota oscila com os juros e com a inflação.",
  IMAB11:
    "ETF de renda fixa que copia o IMA-B, índice de títulos públicos do Tesouro atrelados à inflação (IPCA) de vários vencimentos. O valor da cota oscila com os juros e com a inflação.",
  FIXA11:
    "ETF de renda fixa que acompanha um índice de contratos futuros de juros (DI) com prazo de cerca de três anos. O valor da cota sobe quando os juros prefixados caem e cai quando eles sobem.",
  NASD11:
    "ETF que copia o Nasdaq-100, índice das 100 maiores empresas não financeiras listadas na bolsa Nasdaq, nos Estados Unidos, muitas delas de tecnologia. É negociado em reais, mas acompanha as ações americanas e o dólar.",
  GOLD11:
    "ETF que acompanha o preço do ouro no mercado internacional, em reais. O valor da cota oscila com a cotação do ouro e com o dólar. O ouro não paga juros nem dividendos.",
  HASH11:
    "ETF que copia um índice de criptomoedas, formado principalmente por bitcoin e ether. O valor da cota oscila com o preço dessas moedas e com o dólar, e a variação costuma ser muito maior que a de outros ativos.",
};

export function descricaoDe(ticker: string): string {
  return DESCRICOES[ticker.toUpperCase().trim()] ?? "";
}
