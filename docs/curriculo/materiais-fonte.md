# Os materiais do currículo ficam na área local

O formulário de onboarding salva os materiais em `local/curriculo/materiais-fonte/`, a partir da raiz do projeto:

1. `curriculo.pdf` ou `curriculo.docx`: currículo atual, obrigatório.
2. `linkedin.pdf` ou `linkedin.docx`: perfil do LinkedIn, opcional.

Para colocar os arquivos manualmente, use essa mesma pasta e os mesmos nomes. Depois, a partir da raiz, execute:

```bash
cd core
npm run onboarding -- --extrair
```

PDF e DOCX geram um arquivo `<nome>.extraido.txt` junto dos materiais. Materiais adicionais podem ser PDF, DOCX ou TXT. O agente usa esses textos como fonte. A pasta `local/` fica fora da distribuição e do Git público; este guia permanece em `docs/curriculo/`. Os currículos gerados ficam em `local/curriculo/builds/`.

Cada afirmação do `base_content` precisa ser rastreável a um trecho dos materiais ou a uma resposta da pessoa na entrevista. A extração não confirma experiência, não conclui o onboarding humano e não autoriza candidatura.
