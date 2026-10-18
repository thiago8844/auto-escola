import { useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { paths, organizationPaths } from '../config/paths'
import { useOrganizations } from '../hooks/useOrganizations'
import { usePreferencesStore } from '../stores/preferencesStore'
import { QueryErrorAlert } from './QueryErrorAlert'
import { FullPageSpinner } from './FullPageSpinner'

export function DefaultSpaceRedirect() {
  const defaultSpace = usePreferencesStore((s) => s.defaultSpace)
  const setDefaultSpace = usePreferencesStore((s) => s.setDefaultSpace)
  const query = useOrganizations()
  const selected = query.data?.data.find((o) => String(o.id) === defaultSpace)
  const invalid = !!defaultSpace && !!query.data && !selected
  useEffect(() => { if (invalid) setDefaultSpace(null) }, [invalid, setDefaultSpace])
  if (!defaultSpace) return <Navigate to={paths.organizations} replace />
  if (query.error) return <><QueryErrorAlert error={query.error} onRetry={() => void query.refetch()} /><Link to={paths.organizations}>Escolher outro espaço</Link></>
  if (!query.data) return <FullPageSpinner />
  return <Navigate to={selected ? organizationPaths(selected.id).home : paths.organizations} state={invalid ? { invalidDefault: true } : undefined} replace />
}
