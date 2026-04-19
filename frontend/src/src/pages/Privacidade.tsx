import styles from './Privacidade.module.css'

export default function Privacidade() {
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <a href="/" className={styles.navLogo}>
          <span className={styles.navName}>Dra. Raquel Machado</span>
          <span className={styles.navSub}>Pediatra · Neonatologista</span>
        </a>
      </nav>

      <main className={styles.main}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Transparência</p>
          <h1 className={styles.title}>Política de Privacidade</h1>
          <p className={styles.updated}>Última atualização: abril de 2026</p>
        </header>

        <div className={styles.content}>

          <section className={styles.section}>
            <h2>1. Quem somos</h2>
            <p>
              Este é o site profissional da Dra. Raquel Machado (CRM-RN 9383), pediatra e
              neonatologista, controladora dos dados nos termos da Lei nº 13.709/2018 (LGPD).
              Enquadramo-nos como agente de pequeno porte conforme a Resolução CD/ANPD nº 2/2022,
              com obrigações de transparência simplificadas.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Dados coletados</h2>
            <p>
              <strong>Este site não coleta dados pessoais.</strong> Não há formulários, cadastros,
              cookies próprios, sistemas de rastreamento ou analytics de comportamento.
            </p>
            <p>
              As fontes tipográficas utilizadas são servidas diretamente por este servidor, sem
              requisições a servidores externos. Nenhum dado é transmitido a terceiros pelo
              simples carregamento das páginas.
            </p>
          </section>

          <section className={styles.section}>
            <h2>3. Links externos</h2>
            <p>
              O site contém links para plataformas de terceiros: WhatsApp, Google Maps e Instagram.
              Ao clicar nesses links, você será redirecionado para os respectivos serviços, que
              possuem suas próprias políticas de privacidade. A Dra. Raquel Machado não é
              responsável pelo tratamento de dados realizado por essas plataformas.
            </p>
            <ul>
              <li><strong>WhatsApp:</strong> política disponível em <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">whatsapp.com/legal/privacy-policy</a></li>
              <li><strong>Google:</strong> política disponível em <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a></li>
              <li><strong>Instagram/Meta:</strong> política disponível em <a href="https://privacycenter.instagram.com/policy" target="_blank" rel="noopener noreferrer">privacycenter.instagram.com/policy</a></li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>4. Dados de saúde</h2>
            <p>
              Nenhum dado de saúde é coletado ou tratado por este site. O art. 11 da LGPD,
              que regula o tratamento de dados sensíveis (incluindo dados de saúde), não é
              acionado no contexto desta plataforma.
            </p>
          </section>

          <section className={styles.section}>
            <h2>5. Segurança</h2>
            <p>
              O site utiliza HTTPS com TLS 1.2/1.3, HSTS (Strict-Transport-Security),
              Content Security Policy, X-Frame-Options e demais headers de segurança HTTP
              recomendados pelo OWASP.
            </p>
          </section>

          <section className={styles.section}>
            <h2>6. Direitos do titular (art. 18, LGPD)</h2>
            <p>
              Embora não coletemos dados, você tem o direito de, a qualquer momento:
            </p>
            <ul>
              <li>Solicitar confirmação sobre a existência de tratamento de dados</li>
              <li>Acessar eventuais dados que possuímos</li>
              <li>Solicitar correção, eliminação ou portabilidade de dados</li>
              <li>Revogar consentimento, quando aplicável</li>
              <li>Peticionar à Autoridade Nacional de Proteção de Dados (ANPD)</li>
            </ul>
            <p>
              Para exercer esses direitos ou para qualquer dúvida sobre esta política, entre
              em contato pelo WhatsApp da clínica ou pelo e-mail informado no consultório.
            </p>
          </section>

          <section className={styles.section}>
            <h2>7. Atualizações desta política</h2>
            <p>
              Esta política pode ser atualizada a qualquer momento. A data de última
              atualização consta no topo desta página.
            </p>
          </section>

        </div>
      </main>

      <footer className={styles.footer}>
        <a href="/">← Voltar ao site</a>
        <span>© 2026 Dra. Raquel Machado · CRM-RN 9383</span>
      </footer>
    </div>
  )
}
