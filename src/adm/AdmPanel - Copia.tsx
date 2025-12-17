import { useEffect, useState, FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { styles } from '../styles'
import type { Usuario, HealthData } from '../types'

export function AdmPanel({ perfil }: { perfil: Usuario | null }) {
  // --------- MENU DE ABAS DO ADM ----------
  const [admTab, setAdmTab] = useState<
    'status' | 'usuarios' | 'rotinas' | 'cadastros'
  >('status')

  // --------- ESTADO HEALTH-CHECK ----------
  const [healthStatus, setHealthStatus] = useState(
    'Testando conexão com Supabase + Edge Function...'
  )
  const [healthDetails, setHealthDetails] = useState<string | null>(null)

  // --------- ESTADO FORM DE USUÁRIO ----------
  const [adminKey, setAdminKey] = useState('dev-admin-key-123')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nivel, setNivel] = useState<'ADM' | 'N0' | 'N1' | 'N2' | 'N3' | 'N99'>(
    'N3'
  )
  const [departamentoId, setDepartamentoId] = useState<string>('')
  const [setorId, setSetorId] = useState<string>('')
  const [regionalId, setRegionalId] = useState<string>('')

  const [provisionStatus, setProvisionStatus] = useState<string | null>(null)
  const [provisionDetails, setProvisionDetails] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // --------- ESTADO BLOCO 6 – CRIAR ROTINA (DIÁRIA/SEMANAL/MENSAL) ----------
  const [duracaoMinutos, setDuracaoMinutos] = useState<number>(60)
  const [prioridade, setPrioridade] =
    useState<'ALTA' | 'MEDIA' | 'BAIXA'>('ALTA')
  const [tipoRotina, setTipoRotina] =
    useState<'normal' | 'operacional'>('normal')
  const [periodicidade, setPeriodicidade] = useState<
    'diaria' | 'semanal' | 'mensal'
  >('diaria')

  const [createStatus, setCreateStatus] = useState<string | null>(null)
  const [createDetails, setCreateDetails] = useState<string | null>(null)
  const [isCreatingRotina, setIsCreatingRotina] = useState(false)

  // --------- ESTADO BLOCO 6C – MINHAS ROTINAS ----------
  const [emailMinhasRotinas, setEmailMinhasRotinas] = useState(
    perfil?.email ?? ''
  )

  useEffect(() => {
    if (perfil?.email) {
      setEmailMinhasRotinas(perfil.email)
    }
  }, [perfil?.email])

  const [minhasRotinas, setMinhasRotinas] = useState<any[] | null>(null)
  const [listStatus, setListStatus] = useState<string | null>(null)
  const [listErrorDetails, setListErrorDetails] = useState<string | null>(null)
  const [isLoadingMinhas, setIsLoadingMinhas] = useState(false)

  // --------- ESTADO CADASTROS BASE ----------
  const [depNome, setDepNome] = useState('')
  const [depStatus, setDepStatus] = useState<string | null>(null)

  const [setorNome, setSetorNome] = useState('')
  const [setorDepId, setSetorDepId] = useState('')
  const [setorStatusMsg, setSetorStatusMsg] = useState<string | null>(null)

  const [regionalNome, setRegionalNome] = useState('')
  const [regionalSetorId, setRegionalSetorId] = useState('') // obrigatório
  const [regionalStatusMsg, setRegionalStatusMsg] = useState<string | null>(
    null
  )

  // --------- HEALTH CHECK NA MONTAGEM ----------
  useEffect(() => {
    const run = async () => {
      try {
        const { data, error } = await supabase.functions.invoke<HealthData>(
          'eqf-health-check',
          {
            body: { name: 'EQF V13' },
          }
        )

        if (error) {
          const anyError = error as any
          setHealthStatus('❌ Erro ao chamar eqf-health-check (invoke)')
          setHealthDetails(
            JSON.stringify(
              {
                name: anyError?.name,
                message: anyError?.message,
                context: anyError?.context,
              },
              null,
              2
            )
          )
          return
        }

        if (data?.ok) {
          setHealthStatus(
            '✅ Conexão OK: Front → Edge Function → Supabase (invoke)'
          )
        } else {
          setHealthStatus('⚠️ Função respondeu, mas indicou problema')
        }
        setHealthDetails(JSON.stringify(data, null, 2))
      } catch (e) {
        setHealthStatus('❌ Erro inesperado ao chamar a função (invoke)')
        setHealthDetails(String(e))
      }
    }

    run()
  }, [])

  // --------- HANDLER CADASTRO USUÁRIO ----------
  const handleProvision = async (e: FormEvent) => {
    e.preventDefault()
    setProvisionStatus('⏳ Enviando dados para eqf-provision-user...')
    setProvisionDetails(null)
    setIsSubmitting(true)

    try {
      const { data, error } = await supabase.functions.invoke(
        'eqf-provision-user',
        {
          body: {
            admin_key: adminKey,
            email,
            password: senha,
            nome,
            nivel,
            departamento_id: departamentoId ? Number(departamentoId) : null,
            setor_id: setorId ? Number(setorId) : null,
            regional_id: regionalId ? Number(regionalId) : null,
          },
        }
      )

      if (error) {
        const anyError = error as any
        let extra: any = {}

        if (anyError?.context?.response) {
          try {
            const res: Response = anyError.context.response
            const text = await res.text()
            extra = {
              httpStatus: res.status,
              httpStatusText: res.statusText,
              httpBody: text,
            }
          } catch (err) {
            extra = { errorReadingBody: String(err) }
          }
        }

        setProvisionStatus('❌ Erro ao chamar eqf-provision-user')
        setProvisionDetails(
          JSON.stringify(
            {
              name: anyError?.name,
              message: anyError?.message,
              context: anyError?.context,
              ...extra,
            },
            null,
            2
          )
        )
      } else {
        setProvisionStatus(
          '✅ Usuário criado com sucesso (veja detalhes abaixo).'
        )
        setProvisionDetails(JSON.stringify(data, null, 2))

        setNome('')
        setEmail('')
        setSenha('')
      }
    } catch (e) {
      setProvisionStatus('❌ Erro inesperado ao chamar eqf-provision-user')
      setProvisionDetails(String(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  // --------- HANDLER BLOCO 6 – CRIAR ROTINA ----------
  const handleCreateRotina = async (e: FormEvent) => {
    e.preventDefault()
    setIsCreatingRotina(true)
    setCreateStatus('⏳ Chamando eqf-create-rotina-diaria...')
    setCreateDetails(null)

    try {
      const { data, error } = await supabase.functions.invoke(
        'eqf-create-rotina-diaria',
        {
          body: {
            duracao_minutos: duracaoMinutos,
            prioridade,
            tipo: tipoRotina,
            periodicidade,
          },
        }
      )

      if (error) {
        const anyError = error as any
        setCreateStatus('❌ Erro ao chamar eqf-create-rotina-diaria')
        setCreateDetails(
          JSON.stringify(
            {
              name: anyError?.name,
              message: anyError?.message,
              context: anyError?.context,
            },
            null,
            2
          )
        )
        return
      }

      const labelPeriodicidade =
        periodicidade === 'diaria'
          ? 'DIÁRIA'
          : periodicidade === 'semanal'
          ? 'SEMANAL'
          : 'MENSAL'

      setCreateStatus(`✅ Rotina ${labelPeriodicidade} criada com sucesso.`)
      setCreateDetails(JSON.stringify(data, null, 2))
    } catch (e) {
      setCreateStatus('❌ Erro inesperado ao criar rotina')
      setCreateDetails(String(e))
    } finally {
      setIsCreatingRotina(false)
    }
  }

  // --------- HANDLER BLOCO 6C – LISTAR “MINHAS ROTINAS” ----------
  const handleListMinhasRotinas = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoadingMinhas(true)
    setListStatus('⏳ Buscando rotinas do usuário...')
    setListErrorDetails(null)
    setMinhasRotinas(null)

    try {
      const { data, error } = await supabase.functions.invoke(
        'eqf-list-minhas-rotinas',
        {
          body: {
            email: emailMinhasRotinas,
            limit: 20,
          },
        }
      )

      if (error) {
        const anyError = error as any
        setListStatus('❌ Erro ao chamar eqf-list-minhas-rotinas')
        setListErrorDetails(
          JSON.stringify(
            {
              name: anyError?.name,
              message: anyError?.message,
              context: anyError?.context,
            },
            null,
            2
          )
        )
        return
      }

      setListStatus('✅ Rotinas carregadas com sucesso.')
      setMinhasRotinas((data as any)?.rotinas ?? [])
      setListErrorDetails(JSON.stringify(data, null, 2))
    } catch (e) {
      setListStatus('❌ Erro inesperado ao listar rotinas')
      setListErrorDetails(String(e))
    } finally {
      setIsLoadingMinhas(false)
    }
  }

  // --------- HANDLERS CADASTROS BASE ----------
  const handleCreateDepartamento = async (e: FormEvent) => {
    e.preventDefault()
    setDepStatus('⏳ Gravando departamento...')
    try {
      const { error } = await supabase.from('departamentos').insert({
        nome: depNome,
      })
      if (error) {
        setDepStatus(`❌ Erro: ${error.message}`)
      } else {
        setDepStatus('✅ Departamento criado com sucesso.')
        setDepNome('')
      }
    } catch (err) {
      setDepStatus(`❌ Erro inesperado: ${String(err)}`)
    }
  }

  const handleCreateSetor = async (e: FormEvent) => {
    e.preventDefault()

    if (!setorDepId) {
      setSetorStatusMsg('❌ Informe o ID do departamento (obrigatório).')
      return
    }

    setSetorStatusMsg('⏳ Gravando setor...')
    try {
      const { error } = await supabase.from('setores').insert({
        nome: setorNome,
        departamento_id: Number(setorDepId),
      })
      if (error) {
        setSetorStatusMsg(`❌ Erro: ${error.message}`)
      } else {
        setSetorStatusMsg('✅ Setor criado com sucesso.')
        setSetorNome('')
        setSetorDepId('')
      }
    } catch (err) {
      setSetorStatusMsg(`❌ Erro inesperado: ${String(err)}`)
    }
  }

  const handleCreateRegional = async (e: FormEvent) => {
    e.preventDefault()

    if (!regionalSetorId) {
      setRegionalStatusMsg('❌ Informe o ID do setor (obrigatório).')
      return
    }

    setRegionalStatusMsg('⏳ Gravando regional...')
    try {
      const { error } = await supabase.from('regionais').insert({
        nome: regionalNome,
        setor_id: Number(regionalSetorId),
      })
      if (error) {
        setRegionalStatusMsg(`❌ Erro: ${error.message}`)
      } else {
        setRegionalStatusMsg('✅ Regional criada com sucesso.')
        setRegionalNome('')
        setRegionalSetorId('')
      }
    } catch (err) {
      setRegionalStatusMsg(`❌ Erro inesperado: ${String(err)}`)
    }
  }

  // ---------- RENDER ----------
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* MENU DE ABAS DO ADM */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 8,
          borderBottom: '1px solid #1f2933',
          paddingBottom: 8,
        }}
      >
        {[
          { id: 'status', label: 'Status / Health' },
          { id: 'usuarios', label: 'Usuários' },
          { id: 'rotinas', label: 'Rotinas (B6 / 6C)' },
          { id: 'cadastros', label: 'Cadastros base' },
        ].map((tab) => {
          const active = admTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() =>
                setAdmTab(tab.id as 'status' | 'usuarios' | 'rotinas' | 'cadastros')
              }
              style={{
                ...styles.button,
                padding: '6px 12px',
                fontSize: 12,
                borderRadius: 999,
                border: active ? '1px solid #22c55e' : '1px solid #374151',
                background: active ? '#022c22' : '#020617',
                color: active ? '#bbf7d0' : '#e5e7eb',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ABA: STATUS / HEALTH */}
      {admTab === 'status' && (
        <section
          style={{
            borderRadius: 12,
            border: '1px solid #222',
            padding: 16,
            background: '#050608',
          }}
        >
          <h2 style={{ marginTop: 0, color: '#00ff88' }}>
            Status da verificação
          </h2>
          <p>{healthStatus}</p>

          {healthDetails && (
            <>
              <h3 style={{ marginTop: 16, color: '#ffaa00' }}>
                Detalhes (eqf-health-check)
              </h3>
              <pre
                style={{
                  background: '#000',
                  color: '#0f0',
                  padding: 16,
                  borderRadius: 8,
                  maxHeight: 260,
                  overflow: 'auto',
                  fontSize: 12,
                }}
              >
                {healthDetails}
              </pre>
            </>
          )}
        </section>
      )}

      {/* ABA: USUÁRIOS */}
      {admTab === 'usuarios' && (
        <section
          style={{
            borderRadius: 12,
            border: '1px solid #333',
            padding: 16,
            background:
              'radial-gradient(circle at top right, rgba(255,170,0,0.08), #050608)',
          }}
        >
          <h2 style={{ marginTop: 0, color: '#00ff88' }}>
            Cadastro de Usuário (ADM-CADASTRO)
          </h2>
          <p style={{ fontSize: 13, color: '#ccc' }}>
            Esta tela usa a função <strong>eqf-provision-user</strong> para
            criar usuário em <code>auth.users</code> e em{' '}
            <code>public.usuarios</code>.
          </p>

          <form
            onSubmit={handleProvision}
            style={{
              display: 'grid',
              gap: 12,
              padding: 16,
              borderRadius: 8,
              border: '1px solid #222',
              marginTop: 12,
              marginBottom: 16,
              backgroundColor: '#050608',
            }}
          >
            <div>
              <label style={styles.label}>
                Admin key (desenvolvimento):{' '}
                <input
                  type="text"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  style={styles.input}
                />
              </label>
              <small style={{ color: '#777' }}>Padrão: dev-admin-key-123</small>
            </div>

            <div>
              <label style={styles.label}>Nome completo:</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={styles.input}
                required
              />
            </div>

            <div>
              <label style={styles.label}>E-mail:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
              />
            </div>

            <div>
              <label style={styles.label}>Senha inicial:</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                style={styles.input}
                required
              />
            </div>

            <div>
              <label style={styles.label}>Nível:</label>
              <select
                value={nivel}
                onChange={(e) => setNivel(e.target.value as any)}
                style={styles.input}
              >
                <option value="ADM">ADM (cadastro)</option>
                <option value="N0">Nível 00 (diretor)</option>
                <option value="N1">Nível 1 (gerente nacional setor)</option>
                <option value="N2">Nível 2 (responsável regional)</option>
                <option value="N3">Nível 3 (colaborador)</option>
                <option value="N99">Nível 99 (super admin operacional)</option>
              </select>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}
            >
              <div>
                <label style={styles.label}>Departamento ID:</label>
                <input
                  type="number"
                  value={departamentoId}
                  onChange={(e) => setDepartamentoId(e.target.value)}
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>Setor ID:</label>
                <input
                  type="number"
                  value={setorId}
                  onChange={(e) => setSetorId(e.target.value)}
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>Regional ID:</label>
                <input
                  type="number"
                  value={regionalId}
                  onChange={(e) => setRegionalId(e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                ...styles.button,
                background: isSubmitting ? '#555' : '#00ff88',
                color: '#000',
              }}
            >
              {isSubmitting ? 'Enviando...' : 'Criar usuário'}
            </button>
          </form>

          {provisionStatus && <p>{provisionStatus}</p>}

          {provisionDetails && (
            <>
              <h3 style={{ color: '#ffaa00' }}>Detalhes (eqf-provision-user)</h3>
              <pre
                style={{
                  background: '#000',
                  color: '#0f0',
                  padding: 16,
                  borderRadius: 8,
                  maxHeight: 260,
                  overflow: 'auto',
                  fontSize: 12,
                }}
              >
                {provisionDetails}
              </pre>
            </>
          )}
        </section>
      )}

      {/* ABA: ROTINAS (B6 + 6C) */}
      {admTab === 'rotinas' && (
        <>
          {/* BLOCO 6 */}
          <section
            style={{
              borderRadius: 12,
              border: '1px solid #333',
              padding: 16,
              background:
                'radial-gradient(circle at top left, rgba(0,255,136,0.08), #050608)',
            }}
          >
            <h2 style={{ marginTop: 0, color: '#00ff88' }}>
              Bloco 6 – Criar rotina (teste)
            </h2>
            <p style={{ fontSize: 13, color: '#ccc' }}>
              Este bloco chama a função <code>eqf-create-rotina-diaria</code>{' '}
              para criar uma rotina simples no banco usando o usuário logado
              como responsável. Teste{' '}
              <strong>rotina DIÁRIA, SEMANAL ou MENSAL</strong> abaixo.
            </p>

            <form
              onSubmit={handleCreateRotina}
              style={{
                display: 'grid',
                gap: 12,
                padding: 16,
                borderRadius: 8,
                border: '1px solid #222',
                marginTop: 12,
                marginBottom: 16,
                backgroundColor: '#050608',
              }}
            >
              <div>
                <label style={styles.label}>Duração (minutos):</label>
                <input
                  type="number"
                  min={5}
                  value={duracaoMinutos}
                  onChange={(e) =>
                    setDuracaoMinutos(Number(e.target.value || 0))
                  }
                  style={styles.input}
                />
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 8,
                }}
              >
                <div>
                  <label style={styles.label}>Prioridade:</label>
                  <select
                    value={prioridade}
                    onChange={(e) =>
                      setPrioridade(
                        e.target.value as 'BAIXA' | 'MEDIA' | 'ALTA'
                      )
                    }
                    style={styles.input}
                  >
                    <option value="BAIXA">BAIXA</option>
                    <option value="MEDIA">MÉDIA</option>
                    <option value="ALTA">ALTA</option>
                  </select>
                </div>

                <div>
                  <label style={styles.label}>Tipo de rotina:</label>
                  <select
                    value={tipoRotina}
                    onChange={(e) =>
                      setTipoRotina(
                        e.target.value as 'normal' | 'operacional'
                      )
                    }
                    style={styles.input}
                  >
                    <option value="normal">normal</option>
                    <option value="operacional">operacional</option>
                  </select>
                </div>

                <div>
                  <label style={styles.label}>Periodicidade:</label>
                  <select
                    value={periodicidade}
                    onChange={(e) =>
                      setPeriodicidade(
                        e.target.value as 'diaria' | 'semanal' | 'mensal'
                      )
                    }
                    style={styles.input}
                  >
                    <option value="diaria">diária</option>
                    <option value="semanal">semanal</option>
                    <option value="mensal">mensal</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreatingRotina}
                style={{
                  ...styles.button,
                  background: isCreatingRotina
                    ? '#555'
                    : 'linear-gradient(90deg, #00ff88, #ffaa00)',
                  color: '#000',
                }}
              >
                {isCreatingRotina ? 'Criando...' : 'Criar rotina'}
              </button>
            </form>

            {createStatus && <p>{createStatus}</p>}

            {createDetails && (
              <>
                <h3 style={{ color: '#ffaa00' }}>
                  Detalhes (eqf-create-rotina-diaria)
                </h3>
                <pre
                  style={{
                    background: '#000',
                    color: '#0f0',
                    padding: 16,
                    borderRadius: 8,
                    maxHeight: 260,
                    overflow: 'auto',
                    fontSize: 12,
                  }}
                >
                  {createDetails}
                </pre>
              </>
            )}
          </section>

          {/* BLOCO 6C */}
          <section
            style={{
              borderRadius: 12,
              border: '1px solid #333',
              padding: 16,
              background:
                'radial-gradient(circle at top left, rgba(248,113,113,0.15), #050608)',
            }}
          >
            <h2 style={{ marginTop: 0, color: '#f97316' }}>
              Bloco 6C – Minhas rotinas (teste)
            </h2>
            <p style={{ fontSize: 13, color: '#ccc' }}>
              Este bloco usa a função <code>eqf-list-minhas-rotinas</code> para
              buscar as rotinas em que o usuário é o{' '}
              <strong>responsável</strong>.
            </p>

            <form
              onSubmit={handleListMinhasRotinas}
              style={{
                display: 'grid',
                gap: 12,
                padding: 16,
                borderRadius: 8,
                border: '1px solid #222',
                marginTop: 12,
                marginBottom: 16,
                backgroundColor: '#050608',
              }}
            >
              <div>
                <label style={styles.label}>E-mail do usuário:</label>
                <input
                  type="email"
                  value={emailMinhasRotinas}
                  onChange={(e) => setEmailMinhasRotinas(e.target.value)}
                  style={styles.input}
                  required
                  disabled={!!perfil?.email}
                />
                <small style={{ color: '#777' }}>
                  Usa o e-mail do usuário logado (public.usuarios).
                </small>
              </div>

              <button
                type="submit"
                disabled={isLoadingMinhas}
                style={{
                  ...styles.button,
                  background: isLoadingMinhas
                    ? '#555'
                    : 'linear-gradient(90deg, #00ff88, #ffaa00)',
                  color: '#000',
                }}
              >
                {isLoadingMinhas ? 'Carregando...' : 'Buscar rotinas'}
              </button>
            </form>

            {listStatus && <p>{listStatus}</p>}

            {minhasRotinas && minhasRotinas.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ marginBottom: 8, color: '#22c55e' }}>
                  Rotinas encontradas
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr>
                        {[
                          'Data',
                          'Início',
                          'Título',
                          'Tipo',
                          'Periodicidade',
                          'Duração (min)',
                          'Urgência',
                          'Status',
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: 'left',
                              padding: '6px 8px',
                              borderBottom: '1px solid #374151',
                              background: '#020617',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {minhasRotinas.map((r: any) => (
                        <tr key={r.id}>
                          <td
                            style={{
                              padding: '4px 8px',
                              borderBottom: '1px solid #111827',
                            }}
                          >
                            {r.data_inicio}
                          </td>
                          <td
                            style={{
                              padding: '4px 8px',
                              borderBottom: '1px solid #111827',
                            }}
                          >
                            {r.horario_inicio}
                          </td>
                          <td
                            style={{
                              padding: '4px 8px',
                              borderBottom: '1px solid #111827',
                            }}
                          >
                            {r.titulo}
                          </td>
                          <td
                            style={{
                              padding: '4px 8px',
                              borderBottom: '1px solid #111827',
                            }}
                          >
                            {r.tipo}
                          </td>
                          <td
                            style={{
                              padding: '4px 8px',
                              borderBottom: '1px solid #111827',
                            }}
                          >
                            {r.periodicidade}
                          </td>
                          <td
                            style={{
                              padding: '4px 8px',
                              borderBottom: '1px solid #111827',
                            }}
                          >
                            {r.duracao_minutos}
                          </td>
                          <td
                            style={{
                              padding: '4px 8px',
                              borderBottom: '1px solid #111827',
                            }}
                          >
                            {r.urgencia}
                          </td>
                          <td
                            style={{
                              padding: '4px 8px',
                              borderBottom: '1px solid #111827',
                            }}
                          >
                            {r.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {listErrorDetails && (
              <>
                <h3 style={{ marginTop: 16, color: '#ffaa00' }}>
                  Detalhes (eqf-list-minhas-rotinas)
                </h3>
                <pre
                  style={{
                    background: '#000',
                    color: '#0f0',
                    padding: 16,
                    borderRadius: 8,
                    maxHeight: 260,
                    overflow: 'auto',
                    fontSize: 12,
                  }}
                >
                  {listErrorDetails}
                </pre>
              </>
            )}
          </section>
        </>
      )}

      {/* ABA: CADASTROS BASE */}
      {admTab === 'cadastros' && (
        <section
          style={{
            borderRadius: 12,
            border: '1px solid #333',
            padding: 16,
            background:
              'radial-gradient(circle at top right, rgba(56,189,248,0.15), #050608)',
          }}
        >
          <h2 style={{ marginTop: 0, color: '#38bdf8' }}>
            Cadastros base – Estrutura EQF
          </h2>
          <p style={{ fontSize: 13, color: '#ccc' }}>
            Cadastre a base da hierarquia:{' '}
            <strong>departamento → setor → regional</strong>. Esses cadastros
            serão usados depois para vincular rotinas por área.
          </p>

          {/* Departamento */}
          <div
            style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 10,
              border: '1px solid #1f2933',
              background:
                'linear-gradient(135deg, rgba(8,47,73,0.6), rgba(15,23,42,0.95))',
            }}
          >
            <h3 style={{ marginTop: 0, color: '#e0f2fe' }}>Departamento</h3>
            <form
              onSubmit={handleCreateDepartamento}
              style={{ display: 'grid', gap: 8, maxWidth: 420 }}
            >
              <div>
                <label style={styles.label}>Nome do departamento:</label>
                <input
                  type="text"
                  value={depNome}
                  onChange={(e) => setDepNome(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
              <button
                type="submit"
                style={{
                  ...styles.button,
                  background: 'linear-gradient(90deg, #38bdf8, #22c55e)',
                  color: '#000',
                }}
              >
                Gravar departamento
              </button>
            </form>
            {depStatus && (
              <p style={{ marginTop: 8, fontSize: 12, color: '#e0f2fe' }}>
                {depStatus}
              </p>
            )}
          </div>

          {/* Setor */}
          <div
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 10,
              border: '1px solid #1f2933',
              background:
                'linear-gradient(135deg, rgba(30,64,175,0.5), rgba(15,23,42,0.95))',
            }}
          >
            <h3 style={{ marginTop: 0, color: '#e0e7ff' }}>Setor</h3>
            <form
              onSubmit={handleCreateSetor}
              style={{ display: 'grid', gap: 8, maxWidth: 420 }}
            >
              <div>
                <label style={styles.label}>Nome do setor:</label>
                <input
                  type="text"
                  value={setorNome}
                  onChange={(e) => setSetorNome(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
              <div>
                <label style={styles.label}>Departamento ID (obrigatório):</label>
                <input
                  type="number"
                  value={setorDepId}
                  onChange={(e) => setSetorDepId(e.target.value)}
                  style={styles.input}
                  placeholder="Ex.: 1 (ID do departamento)"
                />
              </div>
              <button
                type="submit"
                style={{
                  ...styles.button,
                  background: 'linear-gradient(90deg, #6366f1, #22c55e)',
                  color: '#000',
                }}
              >
                Gravar setor
              </button>
            </form>
            {setorStatusMsg && (
              <p style={{ marginTop: 8, fontSize: 12, color: '#e0e7ff' }}>
                {setorStatusMsg}
              </p>
            )}
          </div>

          {/* Regional */}
          <div
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 10,
              border: '1px solid #1f2933',
              background:
                'linear-gradient(135deg, rgba(88,28,135,0.55), rgba(15,23,42,0.96))',
            }}
          >
            <h3 style={{ marginTop: 0, color: '#f5d0fe' }}>Regional</h3>
            <form
              onSubmit={handleCreateRegional}
              style={{ display: 'grid', gap: 8, maxWidth: 420 }}
            >
              <div>
                <label style={styles.label}>Nome da regional:</label>
                <input
                  type="text"
                  value={regionalNome}
                  onChange={(e) => setRegionalNome(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
              <div>
                <label style={styles.label}>Setor ID (obrigatório):</label>
                <input
                  type="number"
                  value={regionalSetorId}
                  onChange={(e) => setRegionalSetorId(e.target.value)}
                  style={styles.input}
                  placeholder="Ex.: 1 (ID do setor)"
                />
              </div>
              <button
                type="submit"
                style={{
                  ...styles.button,
                  background: 'linear-gradient(90deg, #f97316, #ec4899)',
                  color: '#000',
                }}
              >
                Gravar regional
              </button>
            </form>
            {regionalStatusMsg && (
              <p style={{ marginTop: 8, fontSize: 12, color: '#f5d0fe' }}>
                {regionalStatusMsg}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
