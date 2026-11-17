import contextlib
import copy
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import verificar_resume as verificador

BASE = {"experience": [{"company": "Empresa Alfa"}], "tools_line": "Ferramenta A · C++ | Produto/Editor"}

class FidelidadeDeclarada(unittest.TestCase):
    def test_itens_conhecidos_reordenados_sem_aviso(self):
        dados = {"experience": [{"company": " empresa   ALFA "}], "tools_line": "C++ | Produto/Editor · Ferramenta A"}
        self.assertEqual(verificador.avisos_declarados(dados, [BASE]), [])

    def test_empresa_e_ferramenta_novas_com_caminho_sem_substring(self):
        dados = {"experience": [{"company": "Empresa Alfa Labs"}], "tools_line": "Ferramenta A Pro · C"}
        avisos = verificador.avisos_declarados(dados, [BASE])
        self.assertEqual([(a['tipo'], a['campo'], a['valor']) for a in avisos], [
            ('empresa_fora_da_base', 'experience[0].company', 'Empresa Alfa Labs'),
            ('ferramenta_fora_da_base', 'tools_line[0]', 'Ferramenta A Pro'),
            ('ferramenta_fora_da_base', 'tools_line[1]', 'C')])

    def test_uniao_bases_e_duplicatas(self):
        dados = {"experience": [{"company": "Empresa Beta"}, {"company": "empresa beta"}], "tools_line": "Ferramenta B; Ferramenta B"}
        self.assertEqual(verificador.avisos_declarados(dados, [BASE, dados]), [])
        self.assertEqual(len(verificador.avisos_declarados(dados, [BASE])), 2)

    def test_nao_faz_ner_em_prosa(self):
        dados = {**BASE, "summary": "Experiência fictícia com Empresa Beta e Ferramenta Z"}
        self.assertEqual(verificador.avisos_declarados(dados, [BASE]), [])

    def test_base_ausente_ou_invalida_expoe_limitacao(self):
        for bases in ([], [{}], [None], [{"experience": [], "tools_line": ""}]):
            self.assertTrue(any(a['tipo'] == 'limitacao' for a in verificador.avisos_declarados(BASE, bases)))

    def test_formato_invalido_nao_silencia(self):
        for dados in ({"experience": "Empresa Alfa", "tools_line": "Ferramenta A"}, {"experience": [{"company": None}], "tools_line": ["Ferramenta A"]}, None):
            self.assertTrue(any(a['tipo'] == 'limitacao' for a in verificador.avisos_declarados(dados, [BASE])))

    def test_loader_so_bases_vigentes_e_sem_escrita(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)
            (p/'base_content_pt.json').write_text(json.dumps(BASE))
            (p/'base_content_en.json').write_text('{invalido')
            (p/'backup.json').write_text(json.dumps({"tools_line": "Ferramenta Antiga"}))
            antes = {x.name: x.read_bytes() for x in p.iterdir()}
            bases, limitacoes = verificador.carregar_bases_declaradas(tmp)
            self.assertEqual(bases, [BASE])
            self.assertTrue(limitacoes)
            self.assertEqual({x.name: x.read_bytes() for x in p.iterdir()}, antes)

    def test_payload_decisoes_gaps_e_idempotencia(self):
        dados = {"experience": [{"company": "Empresa Beta"}], "tools_line": "Ferramenta B"}
        avisos = verificador.avisos_declarados(dados, [BASE])
        antes = copy.deepcopy(avisos)
        payload = verificador.registro_avisos_fidelidade(avisos)
        self.assertEqual(payload, verificador.registro_avisos_fidelidade(avisos + avisos))
        self.assertEqual(payload['avisosFidelidade'], avisos)
        self.assertEqual(len(payload['gaps']), 2)
        self.assertIn('experience[0].company', payload['gaps'][0])
        self.assertEqual(avisos, antes)

    def test_pdf_sintetico_permanece_e_aviso_nao_vira_falha(self):
        from reportlab.pdfgen import canvas
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp); pdf = p/'fixture.pdf'; conteudo = p/'content.json'
            c = canvas.Canvas(str(pdf)); c.setFont('Helvetica', 6)
            for i in range(35): c.drawString(20, 800-i*15, 'Synthetic experience designing useful services with a team and clear process.')
            c.save(); antes = pdf.read_bytes()
            conteudo.write_text(json.dumps({"experience": [{"company": "Empresa Beta"}], "tools_line": "Ferramenta B"}))
            with patch.object(verificador, 'texto_da_base', return_value='', create=True), patch.object(verificador, 'carregar_bases_declaradas', return_value=([BASE], [])), patch('sys.argv', ['verificar_resume.py', str(pdf), str(conteudo)]), contextlib.redirect_stdout(io.StringIO()) as saida:
                verificador.main()
            linhas = saida.getvalue().splitlines()
            payload = json.loads(next(l.split(': ', 1)[1] for l in linhas if l.startswith('AVISOS_FIDELIDADE_JSON: ')))
            self.assertEqual(len(payload['avisosFidelidade']), 2)
            self.assertEqual(len(payload['gaps']), 2)
            self.assertEqual(pdf.read_bytes(), antes)
            self.assertIn('AVISO:', saida.getvalue())

    def test_falha_independente_continua_exit_um(self):
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory() as tmp:
            conteudo = Path(tmp)/'content.json'
            conteudo.write_text(json.dumps(BASE))
            with patch.object(verificador, 'texto_da_base', return_value='', create=True), patch.object(verificador, 'carregar_bases_declaradas', return_value=([BASE], [])), patch.object(verificador, 'texto_do_pdf', return_value=(SimpleNamespace(pages=[1]), 'texto curto')), patch('sys.argv', ['verificar_resume.py', 'fixture.pdf', str(conteudo)]), contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaises(SystemExit) as erro:
                    verificador.main()
            self.assertEqual(erro.exception.code, 1)

    def test_loader_publico_prefere_local_sem_recuperar_modelos(self):
        with tempfile.TemporaryDirectory() as tmp:
            raiz = Path(tmp)
            script = raiz/'skills/adapt-resume/verificar_resume.py'
            script.parent.mkdir(parents=True)
            (raiz/'core').mkdir()
            (raiz/'core/package.json').write_text('{}')
            local = raiz/'local/curriculo'; local.mkdir(parents=True)
            (local/'base_content_pt.json').write_text(json.dumps(BASE))
            (script.parent/'base_content_pt.json').write_text(json.dumps({'tools_line': 'Ferramenta Legada'}))
            with patch.object(verificador, '__file__', str(script)):
                bases, _ = verificador.carregar_bases_declaradas()
            self.assertEqual(bases, [BASE])

if __name__ == '__main__': unittest.main()
