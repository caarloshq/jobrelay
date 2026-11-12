import sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verificar_resume import restricoes_candidatura, contem_termo, contar_travessoes
class Restricoes(unittest.TestCase):
    def test_travessao_e_meia_risca(self):
        self.assertEqual(contar_travessoes("2023 – 2026 — título"), 2)
        self.assertEqual(contar_travessoes("2023 a 2026 - título"), 0)
    def test_nunca_citar_vem_da_pessoa(self):
        dados = {"nunca_citar": [r"27[,.]7\s*%", r"Advanced|Fluent"]}
        self.assertTrue(restricoes_candidatura("Onboarding 27,7%", dados))
        self.assertTrue(restricoes_candidatura("English (Advanced)", dados))
        self.assertFalse(restricoes_candidatura("English (B2)", dados))
    def test_sem_lista_nada_e_proibido(self):
        self.assertFalse(restricoes_candidatura("Onboarding 27,7%", {}))
        self.assertFalse(restricoes_candidatura("Onboarding 27,7%"))
    def test_nao_confunde_ia_com_substring(self):
        self.assertFalse(contem_termo("materiais", "ia"))
        self.assertFalse(contem_termo("email", "ai"))
        self.assertTrue(contem_termo("design com ia", "ia"))
if __name__ == "__main__": unittest.main()


# Nota de ATS, 2026-11-11: beneficios e apresentacao da empresa saem da conta,
# e o termo ausente sem justificativa reprova.
import json, os, tempfile
from verificar_resume import so_requisitos, cobertura, justificativas, termos_que_importam

ANUNCIO = ("Requisitos: experiencia com wireframes e acessibilidade, wireframes de alta fidelidade, "
           "pesquisa com usuarios e acessibilidade em produtos. " * 3 +
           "Beneficios: periodo previsto para parentalidade, periodo previsto para casamento, "
           "Banco Carrefour, Banco Carrefour. Sobre a Empresa: somos 170 pessoas.")

class NotaATS(unittest.TestCase):
    def test_beneficios_e_empresa_saem_da_conta(self):
        termos = termos_que_importam(ANUNCIO)
        self.assertNotIn("periodo previsto", termos)
        self.assertNotIn("banco carrefour", termos)
        self.assertIn("wireframe", " ".join(termos))

    def test_sobre_a_vaga_continua_requisito(self):
        t = so_requisitos("Sobre a vaga: " + "desenhar jornadas e wireframes. " * 10)
        self.assertIn("wireframes", t)

    def test_ausente_sem_motivo_e_cobrado_e_com_motivo_e_aceito(self):
        _, _, ausentes = cobertura(ANUNCIO, "curriculo com pesquisa com usuarios", None)
        self.assertTrue(ausentes)
        with tempfile.TemporaryDirectory() as d:
            arq = os.path.join(d, "decisoes.json")
            json.dump({"ausentesJustificados": {a: "nao e fato da base" for a in ausentes}}, open(arq, "w"))
            just = justificativas(arq, None)
        self.assertEqual([a for a in ausentes if a not in just], [])


# Gate de ponta a ponta pelo script, 2026-11-11: anuncio sem termo reprova,
# termo ausente sem motivo reprova, curriculo que cobre passa.
import subprocess
AQUI = Path(__file__).resolve().parents[1]

class GateNota(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.mkdtemp()
        cls.pdf = os.path.join(cls.dir, "cv.pdf")
        cls.content = str(AQUI / "base_content_pt.json")
        subprocess.run([sys.executable, str(AQUI / "generate_resume.py"), cls.content, cls.pdf],
                       check=True, capture_output=True)

    def rodar(self, anuncio, decisoes=None):
        vaga = os.path.join(self.dir, "vaga.txt")
        open(vaga, "w").write(anuncio)
        args = [sys.executable, str(AQUI / "verificar_resume.py"), self.pdf, self.content, "--vaga", vaga]
        if decisoes is not None:
            arq = os.path.join(self.dir, "decisoes.json")
            json.dump(decisoes, open(arq, "w"))
            args += ["--decisoes", arq]
        return subprocess.run(args, capture_output=True, text=True)

    def test_anuncio_sem_termo_reprova(self):
        r = self.rodar("Vaga para trabalhar conosco. " * 20)
        self.assertEqual(r.returncode, 1)
        self.assertIn("sem termo medido", r.stdout)

    def test_ausente_sem_motivo_reprova(self):
        r = self.rodar("Requisitos: experiencia com kubernetes clusters e kubernetes clusters em nuvem. " * 10)
        self.assertEqual(r.returncode, 1)
        self.assertIn("sem justificativa", r.stdout)

    def test_cabecalho_no_meio_da_frase_nao_corta(self):
        anuncio = ("Sobre a vaga\nOs beneficios do nosso produto chegam a milhoes de pessoas.\n"
                   "Voce vai desenhar wireframes, jornadas e testes de usabilidade com acessibilidade.\n"
                   "Requisitos\nwireframes, acessibilidade, jornadas, design systems\n"
                   "Beneficios\nperiodo previsto para descanso, periodo previsto para festas\n")
        t = so_requisitos(anuncio)
        self.assertIn("wireframes", t)
        self.assertIn("milhoes", t)
        self.assertNotIn("periodo previsto", t)
