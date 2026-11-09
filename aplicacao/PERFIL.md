<!-- jobrelay-fontes-v1:perfil -->
# Perfil e escolhas objetivas

```jobrelay-perfil-manifesto
{
  "total": 94,
  "caminhosSha256": "f09c2c55cff7592353cdb434c04bb31b1c21445cd64a5f9853be9f072bb38504"
}
```

## Respostas pendentes

### Campos do perfil sem resposta

- autorizado_em
- profissional / anos_experiencia
- profissional / anos_na_area_alvo
- profissional / open_source / contribuicoes
- remuneracao / pretensao_clt_mensal_brl
- remuneracao / pretensao_pj_mensal_brl
- remuneracao / pretensao_hora_usd
- remuneracao / remuneracao_atual_mensal_brl
- remuneracao / aceita_faixa_menor_se_o_resto_compensar
- contratacao / aceita_clt
- contratacao / aceita_pj
- contratacao / aceita_cooperativa
- contratacao / aceita_hibrido
- contratacao / aceita_presencial
- contratacao / aceita_mudanca_de_cidade
- perguntas_comuns / ja_trabalhou_na_empresa
- perguntas_comuns / foi_indicado_por_alguem
- perguntas_comuns / possui_disponibilidade_para_viagens
- perguntas_comuns / possui_restricao_de_horario
- perguntas_comuns / como_conheceu_a_vaga
- confirmacoes / parentesco_com_colaboradores


## Respostas disponíveis


## Campos do perfil

### Estrutura do perfil

```jobrelay-campo {"caminho":[],"tipo":"object"}

```

### _nota

```jobrelay-campo {"caminho":["_nota"],"tipo":"string"}
Fatos e autorizações para candidatura. Chega VAZIO de propósito: quem preenche é você, no onboarding, e nada aqui é inventado pelo agente. Consulte RESPOSTAS.md para compor, conferir e registrar o texto. Ausência nas fontes não autoriza resposta negativa.
```

### _opt_in

```jobrelay-campo {"caminho":["_opt_in"],"tipo":"string"}
A candidatura automática (RODADA-DIARIA.md §8) só liga com `autorizado: true` abaixo, preenchido por você. Enquanto for false, o agente prepara currículo e rascunho de resposta, mas NÃO abre navegador para preencher nem enviar formulário.
```

### autorizado

```jobrelay-campo {"caminho":["autorizado"],"tipo":"boolean"}
false
```

### autorizado_em

```jobrelay-campo {"caminho":["autorizado_em"],"tipo":"null"}

```

### bloqueio

```jobrelay-campo {"caminho":["bloqueio"],"tipo":"object"}

```

### bloqueio / _nota

```jobrelay-campo {"caminho":["bloqueio","_nota"],"tipo":"string"}
Domínios onde você NÃO quer que o agente aplique, mesmo autorizado. Um por linha, ex.: 'linkedin.com'.
```

### bloqueio / dominios_bloqueados

```jobrelay-campo {"caminho":["bloqueio","dominios_bloqueados"],"tipo":"array"}

```

### bloqueio / so_bloqueia_candidatura_simplificada

```jobrelay-campo {"caminho":["bloqueio","so_bloqueia_candidatura_simplificada"],"tipo":"boolean"}
false
```

### bloqueio / regra

```jobrelay-campo {"caminho":["bloqueio","regra"],"tipo":"string"}

```

### identidade

```jobrelay-campo {"caminho":["identidade"],"tipo":"object"}

```

### identidade / _nota

```jobrelay-campo {"caminho":["identidade","_nota"],"tipo":"string"}
Só o que um formulário de vaga pede. Documento (CPF, RG, passaporte) NUNCA entra aqui nem em arquivo nenhum do projeto.
```

### identidade / nome_completo

```jobrelay-campo {"caminho":["identidade","nome_completo"],"tipo":"string"}

```

### identidade / nome_primeiro

```jobrelay-campo {"caminho":["identidade","nome_primeiro"],"tipo":"string"}

```

### identidade / nome_do_meio

```jobrelay-campo {"caminho":["identidade","nome_do_meio"],"tipo":"string"}

```

### identidade / nome_ultimo_sobrenome

```jobrelay-campo {"caminho":["identidade","nome_ultimo_sobrenome"],"tipo":"string"}

```

### identidade / nome_profissional

```jobrelay-campo {"caminho":["identidade","nome_profissional"],"tipo":"string"}

```

### identidade / email

```jobrelay-campo {"caminho":["identidade","email"],"tipo":"string"}

```

### identidade / telefone

```jobrelay-campo {"caminho":["identidade","telefone"],"tipo":"string"}

```

### identidade / telefone_pais

```jobrelay-campo {"caminho":["identidade","telefone_pais"],"tipo":"string"}

```

### identidade / linkedin

```jobrelay-campo {"caminho":["identidade","linkedin"],"tipo":"string"}

```

### identidade / portfolio

```jobrelay-campo {"caminho":["identidade","portfolio"],"tipo":"string"}

```

### identidade / pais

```jobrelay-campo {"caminho":["identidade","pais"],"tipo":"string"}

```

### identidade / estado

```jobrelay-campo {"caminho":["identidade","estado"],"tipo":"string"}

```

### identidade / cidade

```jobrelay-campo {"caminho":["identidade","cidade"],"tipo":"string"}

```

### profissional

```jobrelay-campo {"caminho":["profissional"],"tipo":"object"}

```

### profissional / cargo_atual

```jobrelay-campo {"caminho":["profissional","cargo_atual"],"tipo":"string"}

```

### profissional / anos_experiencia

```jobrelay-campo {"caminho":["profissional","anos_experiencia"],"tipo":"null"}

```

### profissional / anos_na_area_alvo

```jobrelay-campo {"caminho":["profissional","anos_na_area_alvo"],"tipo":"null"}

```

### profissional / _nota_anos

```jobrelay-campo {"caminho":["profissional","_nota_anos"],"tipo":"string"}
Anos totais de carreira e anos na área que você está buscando são números diferentes. Não some um no outro.
```

### profissional / escolaridade

```jobrelay-campo {"caminho":["profissional","escolaridade"],"tipo":"string"}

```

### profissional / idiomas

```jobrelay-campo {"caminho":["profissional","idiomas"],"tipo":"object"}

```

### profissional / idiomas / _nota

```jobrelay-campo {"caminho":["profissional","idiomas","_nota"],"tipo":"string"}
Nível como você declararia num formulário, ex.: 'B2'. O currículo nunca eleva o nível declarado aqui.
```

### profissional / idiomas / ingles

```jobrelay-campo {"caminho":["profissional","idiomas","ingles"],"tipo":"string"}

```

### profissional / idiomas / espanhol

```jobrelay-campo {"caminho":["profissional","idiomas","espanhol"],"tipo":"string"}

```

### profissional / idiomas / outro

```jobrelay-campo {"caminho":["profissional","idiomas","outro"],"tipo":"string"}

```

### profissional / open_source

```jobrelay-campo {"caminho":["profissional","open_source"],"tipo":"object"}

```

### profissional / open_source / conhecimento

```jobrelay-campo {"caminho":["profissional","open_source","conhecimento"],"tipo":"string"}

```

### profissional / open_source / contribuicoes

```jobrelay-campo {"caminho":["profissional","open_source","contribuicoes"],"tipo":"null"}

```

### remuneracao

```jobrelay-campo {"caminho":["remuneracao"],"tipo":"object"}

```

### remuneracao / _nota

```jobrelay-campo {"caminho":["remuneracao","_nota"],"tipo":"string"}
Formulário costuma exigir pretensão. Sem estes números o agente para em toda vaga que pergunta.
```

### remuneracao / pretensao_clt_mensal_brl

```jobrelay-campo {"caminho":["remuneracao","pretensao_clt_mensal_brl"],"tipo":"null"}

```

### remuneracao / pretensao_pj_mensal_brl

```jobrelay-campo {"caminho":["remuneracao","pretensao_pj_mensal_brl"],"tipo":"null"}

```

### remuneracao / pretensao_hora_usd

```jobrelay-campo {"caminho":["remuneracao","pretensao_hora_usd"],"tipo":"null"}

```

### remuneracao / remuneracao_atual_mensal_brl

```jobrelay-campo {"caminho":["remuneracao","remuneracao_atual_mensal_brl"],"tipo":"null"}

```

### remuneracao / aceita_faixa_menor_se_o_resto_compensar

```jobrelay-campo {"caminho":["remuneracao","aceita_faixa_menor_se_o_resto_compensar"],"tipo":"null"}

```

### remuneracao / _qual_usar

```jobrelay-campo {"caminho":["remuneracao","_qual_usar"],"tipo":"string"}
Usar o valor do regime que a vaga oferece. Não converter moeda nem período sem critério declarado aqui.
```

### contratacao

```jobrelay-campo {"caminho":["contratacao"],"tipo":"object"}

```

### contratacao / aceita_clt

```jobrelay-campo {"caminho":["contratacao","aceita_clt"],"tipo":"null"}

```

### contratacao / aceita_pj

```jobrelay-campo {"caminho":["contratacao","aceita_pj"],"tipo":"null"}

```

### contratacao / aceita_cooperativa

```jobrelay-campo {"caminho":["contratacao","aceita_cooperativa"],"tipo":"null"}

```

### contratacao / disponibilidade_inicio

```jobrelay-campo {"caminho":["contratacao","disponibilidade_inicio"],"tipo":"string"}

```

### contratacao / aceita_hibrido

```jobrelay-campo {"caminho":["contratacao","aceita_hibrido"],"tipo":"null"}

```

### contratacao / aceita_presencial

```jobrelay-campo {"caminho":["contratacao","aceita_presencial"],"tipo":"null"}

```

### contratacao / aceita_mudanca_de_cidade

```jobrelay-campo {"caminho":["contratacao","aceita_mudanca_de_cidade"],"tipo":"null"}

```

### autodeclaracao

```jobrelay-campo {"caminho":["autodeclaracao"],"tipo":"object"}

```

### autodeclaracao / _nota

```jobrelay-campo {"caminho":["autodeclaracao","_nota"],"tipo":"string"}
Gênero, raça, deficiência e afins. Null quer dizer 'não responder sozinho'. O agente nunca infere um atributo a partir de outro.
```

### autodeclaracao / pode_preencher

```jobrelay-campo {"caminho":["autodeclaracao","pode_preencher"],"tipo":"boolean"}
false
```

### autodeclaracao / _ver

```jobrelay-campo {"caminho":["autodeclaracao","_ver"],"tipo":"string"}
data/dados-pessoais.json (fora do git)
```

### consentimento

```jobrelay-campo {"caminho":["consentimento"],"tipo":"object"}

```

### consentimento / _nota

```jobrelay-campo {"caminho":["consentimento","_nota"],"tipo":"string"}
Aceite de privacidade e de diversidade só quando necessário para uma candidatura cujo envio você autorizou.
```

### consentimento / marcar_lgpd_automaticamente

```jobrelay-campo {"caminho":["consentimento","marcar_lgpd_automaticamente"],"tipo":"boolean"}
false
```

### consentimento / somente_candidatura_com_envio_autorizado

```jobrelay-campo {"caminho":["consentimento","somente_candidatura_com_envio_autorizado"],"tipo":"boolean"}
true
```

### consentimento / opcionais_exigem_decisao

```jobrelay-campo {"caminho":["consentimento","opcionais_exigem_decisao"],"tipo":"boolean"}
true
```

### consentimento / fonte_autorizacao

```jobrelay-campo {"caminho":["consentimento","fonte_autorizacao"],"tipo":"string"}

```

### perguntas_comuns

```jobrelay-campo {"caminho":["perguntas_comuns"],"tipo":"object"}

```

### perguntas_comuns / _nota

```jobrelay-campo {"caminho":["perguntas_comuns","_nota"],"tipo":"string"}
Perguntas que dependem da candidatura ficam null: 'já trabalhou nesta empresa' e 'foi indicado' nunca têm resposta global.
```

### perguntas_comuns / ja_trabalhou_na_empresa

```jobrelay-campo {"caminho":["perguntas_comuns","ja_trabalhou_na_empresa"],"tipo":"null"}

```

### perguntas_comuns / foi_indicado_por_alguem

```jobrelay-campo {"caminho":["perguntas_comuns","foi_indicado_por_alguem"],"tipo":"null"}

```

### perguntas_comuns / possui_disponibilidade_para_viagens

```jobrelay-campo {"caminho":["perguntas_comuns","possui_disponibilidade_para_viagens"],"tipo":"null"}

```

### perguntas_comuns / possui_restricao_de_horario

```jobrelay-campo {"caminho":["perguntas_comuns","possui_restricao_de_horario"],"tipo":"null"}

```

### perguntas_comuns / como_conheceu_a_vaga

```jobrelay-campo {"caminho":["perguntas_comuns","como_conheceu_a_vaga"],"tipo":"null"}

```

### nunca_responder_sozinho

```jobrelay-campo {"caminho":["nunca_responder_sozinho"],"tipo":"array"}

```

### nunca_responder_sozinho / 0

```jobrelay-campo {"caminho":["nunca_responder_sozinho",0],"tipo":"string"}
documento (CPF, RG, passaporte)
```

### nunca_responder_sozinho / 1

```jobrelay-campo {"caminho":["nunca_responder_sozinho",1],"tipo":"string"}
autodeclaração (gênero, raça, deficiência)
```

### nunca_responder_sozinho / 2

```jobrelay-campo {"caminho":["nunca_responder_sozinho",2],"tipo":"string"}
pretensão salarial fora dos valores deste arquivo
```

### nunca_responder_sozinho / 3

```jobrelay-campo {"caminho":["nunca_responder_sozinho",3],"tipo":"string"}
vínculo ou parentesco com alguém da empresa
```

### nunca_responder_sozinho / 4

```jobrelay-campo {"caminho":["nunca_responder_sozinho",4],"tipo":"string"}
teste, vídeo ou qualquer etapa que peça sua presença
```

### rascunho

```jobrelay-campo {"caminho":["rascunho"],"tipo":"object"}

```

### rascunho / _nota

```jobrelay-campo {"caminho":["rascunho","_nota"],"tipo":"string"}
O que o agente pode rascunhar para você conferir, e o que nunca rascunha.
```

### rascunho / pode_rascunhar

```jobrelay-campo {"caminho":["rascunho","pode_rascunhar"],"tipo":"array"}

```

### rascunho / pode_rascunhar / 0

```jobrelay-campo {"caminho":["rascunho","pode_rascunhar",0],"tipo":"string"}
apresentação livre
```

### rascunho / pode_rascunhar / 1

```jobrelay-campo {"caminho":["rascunho","pode_rascunhar",1],"tipo":"string"}
por que esta empresa (com pesquisa e fonte)
```

### rascunho / pode_rascunhar / 2

```jobrelay-campo {"caminho":["rascunho","pode_rascunhar",2],"tipo":"string"}
descrição de experiência
```

### rascunho / pode_rascunhar / 3

```jobrelay-campo {"caminho":["rascunho","pode_rascunhar",3],"tipo":"string"}
resposta objetiva com fato do currículo
```

### rascunho / nunca_rascunha

```jobrelay-campo {"caminho":["rascunho","nunca_rascunha"],"tipo":"array"}

```

### rascunho / nunca_rascunha / 0

```jobrelay-campo {"caminho":["rascunho","nunca_rascunha",0],"tipo":"string"}
opinião pessoal sem fonte
```

### rascunho / nunca_rascunha / 1

```jobrelay-campo {"caminho":["rascunho","nunca_rascunha",1],"tipo":"string"}
motivação inventada
```

### rascunho / nunca_rascunha / 2

```jobrelay-campo {"caminho":["rascunho","nunca_rascunha",2],"tipo":"string"}
qualquer campo de nunca_responder_sozinho
```

### rascunho / todo_rascunho_para_e_espera

```jobrelay-campo {"caminho":["rascunho","todo_rascunho_para_e_espera"],"tipo":"boolean"}
true
```

### rascunho / _nunca_citar

```jobrelay-campo {"caminho":["rascunho","_nunca_citar"],"tipo":"string"}
Mora em um lugar só: base_content.nunca_citar (Skills/adapt-resume/). Verificador do PDF e gerador de instrução leem de lá.
```

### confirmacoes

```jobrelay-campo {"caminho":["confirmacoes"],"tipo":"object"}

```

### confirmacoes / _nota

```jobrelay-campo {"caminho":["confirmacoes","_nota"],"tipo":"string"}
Fatos que você declarou explicitamente, com data e escopo. Ausência no currículo NÃO é confirmação negativa.
```

### confirmacoes / parentesco_com_colaboradores

```jobrelay-campo {"caminho":["confirmacoes","parentesco_com_colaboradores"],"tipo":"null"}

```
