# Materiais-fonte

O formulário salva os materiais nesta pasta, sem enviá-los para serviços externos:

1. `curriculo.pdf` ou `curriculo.docx`: currículo obrigatório.
2. `linkedin.pdf` ou `linkedin.docx`: perfil do LinkedIn, opcional.
3. `adicional.pdf`, `adicional.docx` ou `adicional.txt`: material adicional, opcional.

O limite é de 15 MB por arquivo. O TXT deve usar UTF-8. Se houver formatos antigos do mesmo material, a tela usa o mais recente; os anteriores são preservados.

Colocou à mão? Use os mesmos nomes e rode, dentro de `vagas/`:

```bash
npm run onboarding -- --extrair
```

Cada material vira `<nome>.extraido.txt`, que é o que o agente lê. A pasta `Skills/adapt-resume/materiais-fonte/` está no `.gitignore`, exceto seu README legado. Este guia descreve os formatos atuais sem alterar os materiais pessoais. Regra 1 do projeto vale aqui: nunca inventar. Cada frase do `base_content` tem que ser rastreável a um trecho destes materiais, ou a uma resposta sua na entrevista.
