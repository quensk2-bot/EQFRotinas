import { useEffect, useState, FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { styles } from '../styles'
import type { Usuario, HealthData } from '../types'

type Departamento = { id: number; nome: string }
type Setor = { id: number; nome: string; departamento_id: number | null }
type Regional = { id: number; nome: string; setor_id: number | null }

export function AdmPanel({ perfil }: { perfil: Usuario | null }) {
  // --------- MENU DE ABAS DO ADM ----------
  const [admTab, setAdmTab] = useState<'status' | 'usuarios' | 'cadastros'>(
    'status'
  )

  // --------- ESTADO HEALTH-CHECK ----------
  const [healthStatus, setHealthStatus] = useState(
    'Testando conexão com Supabase + Edge Function...'
  )
  const [healthDetails, setHealthDetails] = useState<string | null>(null)

  // --------- ESTADO FORM DE USUÁRIO (CADASTRO) ----------
  const [adminKey, setAdminKey] = useState('dev-admin-key-123')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [nivel, setNivel] = useState<Usuario['nivel']>('N3')
  const [departamentoId, setDepartamentoId] = useState<string>('')
  const [setorId, setSetorId] = useState<string>('')
  const [regionalId, setRegionalId] = useState<string>('')

  const [provisionStatus, setProvisionStatus] = useState<string | null>(null)
  const [provisionDetails, setProvisionDetails] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // --------- LISTA / EDIÇÃO DE USUÁRIOS ----------
  const [usuariosLista, setUsuariosLista] = useState<Usuario[]>([])
  const [usuariosLoading, setUsuariosLoading] = useState(false)
  const [usuariosError, setUsuariosError] = useState<string | null>(null)

  const [editUserId, setEditUserId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editNivel, setEditNivel] = useState<Usuario['nivel']>('N3')
  const [editUserDepId, setEditUserDepId] = useState<string>('')
  const [editUserSetorId, setEditUserSetorId] = useState<string>('')
  const [editUserRegionalId, setEditUserRegionalId] = useState<string>('')

  // --------- ESTADO CADASTROS BASE (CRIAÇÃO) ----------
  const [depNome, setDepNome] = useState('')
  const [depStatus, setDepStatus] = useState<string | null>(null)

  const [setorNome, setSetorNome] = useState('')
  const [setorDepId, setSetorDepId] = useState('')
  const [setorStatusMsg, setSetorStatusMsg] = useState<string | null>(null)

  const [regionalNome, setRegionalNome] = useState('')
  const [regionalSetorId, setRegionalSetorId] = useState('')
  const [regionalStatusMsg, setRegionalStatusMsg] = useState<string | null>(
    null
  )

  // --------- LISTAS BASE ---------
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [regionais, setRegionais] = useState<Regional[]>([])

  // --------- EDIÇÃO CADASTROS BASE ----------
  const [editDepBaseId, setEditDepBaseId] = useState<number | null>(null)
  const [editDepBaseNome, setEditDepBaseNome] = useState('')

  const [editSetorBaseId, setEditSetorBaseId] = useState<number | null>(null)
  const [editSetorBaseNome, setEditSetorBaseNome] = useState('')
  const [editSetorBaseDepId, setEditSetorBaseDepId] = useState<string>('')

  const [editRegionalBaseId, setEditRegionalBaseId] = useState<number | null>(
    null
  )
  const [editRegionalBaseNome, setEditRegionalBaseNome] = useState('')
  const [editRegionalBaseSetorId, setEditRegionalBaseSetorId] =
    useState<string>('')

  // --------- CARREGAR STATUS + LISTAS NA MONTAGEM ----------
  useEffect(() => {
    const run = async () => {
      // health-check
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
        } else {
          if (data?.ok) {
            setHealthStatus(
              '✅ Conexão OK: Front → Edge Function → Supabase (invoke)'
            )
          } else {
            setHealthStatus('⚠️ Função respondeu, mas indicou problema')
          }
          setHealthDetails(JSON.stringify(data, null, 2))
        }
      } catch (e) {
        setHealthStatus('❌ Erro inesperado ao chamar a função (invoke)')
        setHealthDetails(String(e))
      }

      await carregarDepartamentos()
      await carregarSetores()
      await carregarRegionais()
      await carregarUsuarios()
    }

    run()
  }, [])

  const carregarDepartamentos = async () => {
    const { data, error } = await supabase
      .from('departamentos')
      .select('id, nome')
      .order('nome', { ascending: true })

    if (!error && data) {
      setDepartamentos(data as Departamento[])
    }
  }

  const carregarSetores = async () => {
    const { data, error } = await supabase
      .from('setores')
      .select('id, nome, departamento_id')
      .order('nome', { ascending: true })

    if (!error && data) {
      setSetores(data as Setor[])
    }
  }

  const carregarRegionais = async () => {
    const { data, error } = await supabase
      .from('regionais')
      .select('id, nome, setor_id')
      .order('nome', { ascending: true })

    if (!error && data) {
      setRegionais(data as Regional[])
    }
  }

  const carregarUsuarios = async () => {
    setUsuariosLoading(true)
    setUsuariosError(null)
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, email, nivel, departamento_id, setor_id, regional_id')
        .order('nome', { ascending: true })

      if (error) {
        setUsuariosError(error.message)
      } else {
        setUsuariosLista((data ?? []) as Usuario[])
      }
    } catch (e) {
      setUsuariosError(String(e))
    } finally {
      setUsuariosLoading(false)
    }
  }

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

        await carregarUsuarios()
      }
    } catch (e) {
      setProvisionStatus('❌ Erro inesperado ao chamar eqf-provision-user')
      setProvisionDetails(String(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  // --------- HANDLERS EDIÇÃO / EXCLUSÃO USUÁRIO ----------
  const iniciarEdicaoUsuario = (u: Usuario) => {
    setEditUserId(u.id)
    setEditNome(u.nome)
    setEditNivel(u.nivel)
    setEditUserDepId(u.departamento_id ? String(u.departamento_id) : '')
    setEditUserSetorId(u.setor_id ? String(u.setor_id) : '')
    setEditUserRegionalId(u.regional_id ? String(u.regional_id) : '')
  }

  const cancelarEdicaoUsuario = () => {
    setEditUserId(null)
    setEditNome('')
    setEditUserDepId('')
    setEditUserSetorId('')
    setEditUserRegionalId('')
  }

  const salvarEdicaoUsuario = async (e: FormEvent) => {
    e.preventDefault()
    if (!editUserId) return

    try {
      const { error } = await supabase
        .from('usuarios')
        .update({
          nome: editNome,
          nivel: editNivel,
          departamento_id: editUserDepId ? Number(editUserDepId) : null,
          setor_id: editUserSetorId ? Number(editUserSetorId) : null,
          regional_id: editUserRegionalId ? Number(editUserRegionalId) : null,
        })
        .eq('id', editUserId)

      if (error) {
        alert('Erro ao atualizar usuário: ' + error.message)
      } else {
        await carregarUsuarios()
        cancelarEdicaoUsuario()
      }
    } catch (e) {
      alert('Erro inesperado ao atualizar usuário: ' + String(e))
    }
  }

  const excluirUsuario = async (id: string) => {
    const ok = window.confirm(
      'Tem certeza que deseja excluir este usuário da tabela public.usuarios?'
    )
    if (!ok) return

    try {
      const { error } = await supabase.from('usuarios').delete().eq('id', id)
      if (error) {
        alert('Erro ao excluir usuário: ' + error.message)
      } else {
        await carregarUsuarios()
      }
    } catch (e) {
      alert('Erro inesperado ao excluir usuário: ' + String(e))
    }
  }

  // --------- HANDLERS CADASTROS BASE (CRIAÇÃO) ----------
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
        await carregarDepartamentos()
      }
    } catch (err) {
      setDepStatus(`❌ Erro inesperado: ${String(err)}`)
    }
  }

  const handleCreateSetor = async (e: FormEvent) => {
    e.preventDefault()

    if (!setorDepId) {
      setSetorStatusMsg('❌ Selecione o departamento (obrigatório).')
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
        await carregarSetores()
      }
    } catch (err) {
      setSetorStatusMsg(`❌ Erro inesperado: ${String(err)}`)
    }
  }

  const handleCreateRegional = async (e: FormEvent) => {
    e.preventDefault()

    if (!regionalSetorId) {
      setRegionalStatusMsg('❌ Selecione o setor (obrigatório).')
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
        await carregarRegionais()
      }
    } catch (err) {
      setRegionalStatusMsg(`❌ Erro inesperado: ${String(err)}`)
    }
  }

  // --------- EDIÇÃO / EXCLUSÃO – DEPARTAMENTO ----------
  const iniciarEdicaoDepartamento = (d: Departamento) => {
    setEditDepBaseId(d.id)
    setEditDepBaseNome(d.nome)
  }

  const cancelarEdicaoDepartamento = () => {
    setEditDepBaseId(null)
    setEditDepBaseNome('')
  }

  const salvarEdicaoDepartamento = async (e: FormEvent) => {
    e.preventDefault()
    if (!editDepBaseId) return

    try {
      const { error } = await supabase
        .from('departamentos')
        .update({ nome: editDepBaseNome })
        .eq('id', editDepBaseId)

      if (error) {
        alert('Erro ao atualizar departamento: ' + error.message)
      } else {
        await carregarDepartamentos()
        cancelarEdicaoDepartamento()
      }
    } catch (e) {
      alert('Erro inesperado ao atualizar departamento: ' + String(e))
    }
  }

  const excluirDepartamento = async (id: number) => {
    const ok = window.confirm(
      'Excluir departamento? Pode falhar se houver setores/usuários vinculados.'
    )
    if (!ok) return

    try {
      const { error } = await supabase
        .from('departamentos')
        .delete()
        .eq('id', id)
      if (error) {
        alert('Erro ao excluir departamento: ' + error.message)
      } else {
        await carregarDepartamentos()
        await carregarSetores()
        await carregarUsuarios()
      }
    } catch (e) {
      alert('Erro inesperado ao excluir departamento: ' + String(e))
    }
  }

  // --------- EDIÇÃO / EXCLUSÃO – SETOR ----------
  const iniciarEdicaoSetor = (s: Setor) => {
    setEditSetorBaseId(s.id)
    setEditSetorBaseNome(s.nome)
    setEditSetorBaseDepId(s.departamento_id ? String(s.departamento_id) : '')
  }

  const cancelarEdicaoSetor = () => {
    setEditSetorBaseId(null)
    setEditSetorBaseNome('')
    setEditSetorBaseDepId('')
  }

  const salvarEdicaoSetor = async (e: FormEvent) => {
    e.preventDefault()
    if (!editSetorBaseId) return

    if (!editSetorBaseDepId) {
      alert('Selecione o departamento para o setor.')
      return
    }

    try {
      const { error } = await supabase
        .from('setores')
        .update({
          nome: editSetorBaseNome,
          departamento_id: Number(editSetorBaseDepId),
        })
        .eq('id', editSetorBaseId)

      if (error) {
        alert('Erro ao atualizar setor: ' + error.message)
      } else {
        await carregarSetores()
        await carregarRegionais()
        cancelarEdicaoSetor()
      }
    } catch (e) {
      alert('Erro inesperado ao atualizar setor: ' + String(e))
    }
  }

  const excluirSetor = async (id: number) => {
    const ok = window.confirm(
      'Excluir setor? Pode falhar se houver regionais/usuários vinculados.'
    )
    if (!ok) return

    try {
      const { error } = await supabase.from('setores').delete().eq('id', id)
      if (error) {
        alert('Erro ao excluir setor: ' + error.message)
      } else {
        await carregarSetores()
        await carregarRegionais()
        await carregarUsuarios()
      }
    } catch (e) {
      alert('Erro inesperado ao excluir setor: ' + String(e))
    }
  }

  // --------- EDIÇÃO / EXCLUSÃO – REGIONAL ----------
  const iniciarEdicaoRegional = (r: Regional) => {
    setEditRegionalBaseId(r.id)
    setEditRegionalBaseNome(r.nome)
    setEditRegionalBaseSetorId(r.setor_id ? String(r.setor_id) : '')
  }

  const cancelarEdicaoRegional = () => {
    setEditRegionalBaseId(null)
    setEditRegionalBaseNome('')
    setEditRegionalBaseSetorId('')
  }

  const salvarEdicaoRegional = async (e: FormEvent) => {
    e.preventDefault()
    if (!editRegionalBaseId) return
    if (!editRegionalBaseSetorId) {
      alert('Selecione o setor para a regional.')
      return
    }

    try {
      const { error } = await supabase
        .from('regionais')
        .update({
          nome: editRegionalBaseNome,
          setor_id: Number(editRegionalBaseSetorId),
        })
        .eq('id', editRegionalBaseId)

      if (error) {
        alert('Erro ao atualizar regional: ' + error.message)
      } else {
        await carregarRegionais()
        cancelarEdicaoRegional()
      }
    } catch (e) {
      alert('Erro inesperado ao atualizar regional: ' + String(e))
    }
  }

  const excluirRegional = async (id: number) => {
    const ok = window.confirm(
      'Excluir regional? Pode falhar se houver usuários vinculados.'
    )
    if (!ok) return

    try {
      const { error } = await supabase.from('regionais').delete().eq('id', id)
      if (error) {
        alert('Erro ao excluir regional: ' + error.message)
      } else {
        await carregarRegionais()
        await carregarUsuarios()
      }
    } catch (e) {
      alert('Erro inesperado ao excluir regional: ' + String(e))
    }
  }

  // --------- HELPERS DE NOME ---------
  const nomeDepartamentoPorId = (id: number | null) => {
    if (id == null) return '-'
    const d = departamentos.find((x) => x.id === id)
    return d ? d.nome : String(id)
  }

  const nomeSetorPorId = (id: number | null) => {
    if (id == null) return '-'
    const s = setores.find((x) => x.id === id)
    return s ? s.nome : String(id)
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
          { id: 'cadastros', label: 'Cadastros base' },
        ].map((tab) => {
          const active = admTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() =>
                setAdmTab(tab.id as 'status' | 'usuarios' | 'cadastros')
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
            Usuários – Cadastro e Gestão
          </h2>
          <p style={{ fontSize: 13, color: '#ccc' }}>
            Crie novos usuários via <strong>eqf-provision-user</strong> e
            gerencie os existentes na tabela <code>public.usuarios</code>.
          </p>

          {/* FORM CADASTRO */}
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
                onChange={(e) => setNivel(e.target.value as Usuario['nivel'])}
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

          {/* LISTA DE USUÁRIOS */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 12,
              borderTop: '1px dashed #374151',
            }}
          >
            <h3 style={{ color: '#22c55e', marginBottom: 8 }}>
              Usuários cadastrados
            </h3>

            {usuariosLoading && (
              <p style={{ fontSize: 13, color: '#ccc' }}>Carregando...</p>
            )}
            {usuariosError && (
              <p style={{ fontSize: 13, color: '#fca5a5' }}>
                Erro: {usuariosError}
              </p>
            )}

            {!usuariosLoading && usuariosLista.length === 0 && (
              <p style={{ fontSize: 13, color: '#ccc' }}>
                Nenhum usuário encontrado.
              </p>
            )}

            {usuariosLista.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        'Nome',
                        'E-mail',
                        'Nível',
                        'Departamento',
                        'Setor',
                        'Regional',
                        'Ações',
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
                    {usuariosLista.map((u) => (
                      <tr key={u.id}>
                        <td
                          style={{
                            padding: '4px 8px',
                            borderBottom: '1px solid #111827',
                          }}
                        >
                          {u.nome}
                        </td>
                        <td
                          style={{
                            padding: '4px 8px',
                            borderBottom: '1px solid #111827',
                          }}
                        >
                          {u.email}
                        </td>
                        <td
                          style={{
                            padding: '4px 8px',
                            borderBottom: '1px solid #111827',
                          }}
                        >
                          {u.nivel}
                        </td>
                        <td
                          style={{
                            padding: '4px 8px',
                            borderBottom: '1px solid #111827',
                          }}
                        >
                          {nomeDepartamentoPorId(u.departamento_id)}
                        </td>
                        <td
                          style={{
                            padding: '4px 8px',
                            borderBottom: '1px solid #111827',
                          }}
                        >
                          {nomeSetorPorId(u.setor_id)}
                        </td>
                        <td
                          style={{
                            padding: '4px 8px',
                            borderBottom: '1px solid #111827',
                          }}
                        >
                          {u.regional_id ?? '-'}
                        </td>
                        <td
                          style={{
                            padding: '4px 8px',
                            borderBottom: '1px solid #111827',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => iniciarEdicaoUsuario(u)}
                            style={{
                              ...styles.button,
                              padding: '4px 8px',
                              fontSize: 11,
                              background: '#0f766e',
                              color: '#ecfdf5',
                              marginRight: 4,
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirUsuario(u.id)}
                            style={{
                              ...styles.button,
                              padding: '4px 8px',
                              fontSize: 11,
                              background: '#7f1d1d',
                              color: '#fee2e2',
                            }}
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* FORM EDIÇÃO USUÁRIO */}
            {editUserId && (
              <form
                onSubmit={salvarEdicaoUsuario}
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid #374151',
                  background: '#020617',
                  display: 'grid',
                  gap: 8,
                }}
              >
                <h4 style={{ margin: 0, color: '#e5e7eb' }}>
                  Editar usuário selecionado
                </h4>
                <div>
                  <label style={styles.label}>Nome:</label>
                  <input
                    type="text"
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>
                <div>
                  <label style={styles.label}>Nível:</label>
                  <select
                    value={editNivel}
                    onChange={(e) =>
                      setEditNivel(e.target.value as Usuario['nivel'])
                    }
                    style={styles.input}
                  >
                    <option value="ADM">ADM</option>
                    <option value="N0">N0</option>
                    <option value="N1">N1</option>
                    <option value="N2">N2</option>
                    <option value="N3">N3</option>
                    <option value="N99">N99</option>
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
                      value={editUserDepId}
                      onChange={(e) => setEditUserDepId(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Setor ID:</label>
                    <input
                      type="number"
                      value={editUserSetorId}
                      onChange={(e) => setEditUserSetorId(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Regional ID:</label>
                    <input
                      type="number"
                      value={editUserRegionalId}
                      onChange={(e) => setEditUserRegionalId(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="submit"
                    style={{
                      ...styles.button,
                      background:
                        'linear-gradient(90deg, #22c55e, #a3e635)',
                      color: '#000',
                    }}
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={cancelarEdicaoUsuario}
                    style={{
                      ...styles.button,
                      background: '#111827',
                      color: '#e5e7eb',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
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
            Cadastre e gerencie a base da hierarquia:{' '}
            <strong>departamento → setor → regional</strong>.
          </p>

          {/* --------- DEPARTAMENTO --------- */}
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

            {/* Lista de departamentos */}
            {departamentos.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ margin: 0, color: '#e0f2fe', fontSize: 13 }}>
                  Departamentos cadastrados
                </h4>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '4px 6px',
                          borderBottom: '1px solid #1f2933',
                        }}
                      >
                        Nome
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '4px 6px',
                          borderBottom: '1px solid #1f2933',
                        }}
                      >
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {departamentos.map((d) => (
                      <tr key={d.id}>
                        <td
                          style={{
                            padding: '4px 6px',
                            borderBottom: '1px solid #020617',
                          }}
                        >
                          {d.nome}
                        </td>
                        <td
                          style={{
                            padding: '4px 6px',
                            borderBottom: '1px solid #020617',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => iniciarEdicaoDepartamento(d)}
                            style={{
                              ...styles.button,
                              padding: '3px 8px',
                              fontSize: 11,
                              background: '#0f766e',
                              color: '#ecfdf5',
                              marginRight: 4,
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirDepartamento(d.id)}
                            style={{
                              ...styles.button,
                              padding: '3px 8px',
                              fontSize: 11,
                              background: '#7f1d1d',
                              color: '#fee2e2',
                            }}
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {editDepBaseId && (
                  <form
                    onSubmit={salvarEdicaoDepartamento}
                    style={{
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid #1f2933',
                      background: '#020617',
                      display: 'grid',
                      gap: 6,
                    }}
                  >
                    <h5
                      style={{
                        margin: 0,
                        color: '#e5e7eb',
                        fontSize: 13,
                      }}
                    >
                      Editar departamento
                    </h5>
                    <input
                      type="text"
                      value={editDepBaseNome}
                      onChange={(e) => setEditDepBaseNome(e.target.value)}
                      style={styles.input}
                      required
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="submit"
                        style={{
                          ...styles.button,
                          background:
                            'linear-gradient(90deg, #22c55e, #a3e635)',
                          color: '#000',
                        }}
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={cancelarEdicaoDepartamento}
                        style={{
                          ...styles.button,
                          background: '#111827',
                          color: '#e5e7eb',
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* --------- SETOR --------- */}
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
                <label style={styles.label}>Departamento (obrigatório):</label>
                <select
                  value={setorDepId}
                  onChange={(e) => setSetorDepId(e.target.value)}
                  style={styles.input}
                >
                  <option value="">Selecione o departamento</option>
                  {departamentos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome}
                    </option>
                  ))}
                </select>
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

            {/* Lista de setores */}
            {setores.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ margin: 0, color: '#e0e7ff', fontSize: 13 }}>
                  Setores cadastrados
                </h4>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '4px 6px',
                          borderBottom: '1px solid #1f2933',
                        }}
                      >
                        Nome
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '4px 6px',
                          borderBottom: '1px solid #1f2933',
                        }}
                      >
                        Departamento
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '4px 6px',
                          borderBottom: '1px solid #1f2933',
                        }}
                      >
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {setores.map((s) => (
                      <tr key={s.id}>
                        <td
                          style={{
                            padding: '4px 6px',
                            borderBottom: '1px solid #020617',
                          }}
                        >
                          {s.nome}
                        </td>
                        <td
                          style={{
                            padding: '4px 6px',
                            borderBottom: '1px solid #020617',
                          }}
                        >
                          {nomeDepartamentoPorId(s.departamento_id)}
                        </td>
                        <td
                          style={{
                            padding: '4px 6px',
                            borderBottom: '1px solid #020617',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => iniciarEdicaoSetor(s)}
                            style={{
                              ...styles.button,
                              padding: '3px 8px',
                              fontSize: 11,
                              background: '#0f766e',
                              color: '#ecfdf5',
                              marginRight: 4,
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirSetor(s.id)}
                            style={{
                              ...styles.button,
                              padding: '3px 8px',
                              fontSize: 11,
                              background: '#7f1d1d',
                              color: '#fee2e2',
                            }}
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {editSetorBaseId && (
                  <form
                    onSubmit={salvarEdicaoSetor}
                    style={{
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid #1f2933',
                      background: '#020617',
                      display: 'grid',
                      gap: 6,
                    }}
                  >
                    <h5
                      style={{
                        margin: 0,
                        color: '#e5e7eb',
                        fontSize: 13,
                      }}
                    >
                      Editar setor
                    </h5>
                    <input
                      type="text"
                      value={editSetorBaseNome}
                      onChange={(e) => setEditSetorBaseNome(e.target.value)}
                      style={styles.input}
                      required
                    />
                    <select
                      value={editSetorBaseDepId}
                      onChange={(e) => setEditSetorBaseDepId(e.target.value)}
                      style={styles.input}
                    >
                      <option value="">Selecione o departamento</option>
                      {departamentos.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nome}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="submit"
                        style={{
                          ...styles.button,
                          background:
                            'linear-gradient(90deg, #22c55e, #a3e635)',
                          color: '#000',
                        }}
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={cancelarEdicaoSetor}
                        style={{
                          ...styles.button,
                          background: '#111827',
                          color: '#e5e7eb',
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* --------- REGIONAL --------- */}
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
                <label style={styles.label}>Setor (obrigatório):</label>
                <select
                  value={regionalSetorId}
                  onChange={(e) => setRegionalSetorId(e.target.value)}
                  style={styles.input}
                >
                  <option value="">Selecione o setor</option>
                  {setores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
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

            {/* Lista de regionais */}
            {regionais.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h4 style={{ margin: 0, color: '#f5d0fe', fontSize: 13 }}>
                  Regionais cadastradas
                </h4>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '4px 6px',
                          borderBottom: '1px solid #1f2933',
                        }}
                      >
                        Nome
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '4px 6px',
                          borderBottom: '1px solid #1f2933',
                        }}
                      >
                        Setor
                      </th>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '4px 6px',
                          borderBottom: '1px solid #1f2933',
                        }}
                      >
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionais.map((r) => (
                      <tr key={r.id}>
                        <td
                          style={{
                            padding: '4px 6px',
                            borderBottom: '1px solid #020617',
                          }}
                        >
                          {r.nome}
                        </td>
                        <td
                          style={{
                            padding: '4px 6px',
                            borderBottom: '1px solid #020617',
                          }}
                        >
                          {nomeSetorPorId(r.setor_id)}
                        </td>
                        <td
                          style={{
                            padding: '4px 6px',
                            borderBottom: '1px solid #020617',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => iniciarEdicaoRegional(r)}
                            style={{
                              ...styles.button,
                              padding: '3px 8px',
                              fontSize: 11,
                              background: '#0f766e',
                              color: '#ecfdf5',
                              marginRight: 4,
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => excluirRegional(r.id)}
                            style={{
                              ...styles.button,
                              padding: '3px 8px',
                              fontSize: 11,
                              background: '#7f1d1d',
                              color: '#fee2e2',
                            }}
                          >
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {editRegionalBaseId && (
                  <form
                    onSubmit={salvarEdicaoRegional}
                    style={{
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 8,
                      border: '1px solid #1f2933',
                      background: '#020617',
                      display: 'grid',
                      gap: 6,
                    }}
                  >
                    <h5
                      style={{
                        margin: 0,
                        color: '#e5e7eb',
                        fontSize: 13,
                      }}
                    >
                      Editar regional
                    </h5>
                    <input
                      type="text"
                      value={editRegionalBaseNome}
                      onChange={(e) => setEditRegionalBaseNome(e.target.value)}
                      style={styles.input}
                      required
                    />
                    <select
                      value={editRegionalBaseSetorId}
                      onChange={(e) =>
                        setEditRegionalBaseSetorId(e.target.value)
                      }
                      style={styles.input}
                    >
                      <option value="">Selecione o setor</option>
                      {setores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="submit"
                        style={{
                          ...styles.button,
                          background:
                            'linear-gradient(90deg, #22c55e, #a3e635)',
                          color: '#000',
                        }}
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={cancelarEdicaoRegional}
                        style={{
                          ...styles.button,
                          background: '#111827',
                          color: '#e5e7eb',
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
