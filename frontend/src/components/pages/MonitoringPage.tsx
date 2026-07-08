import React, { useState } from 'react'
import { Box, Card, CardContent, Typography } from '@mui/material'
import AppLayout from '@/components/layout/AppLayout'
import MonitoringWorkflow from '@/components/MonitoringWorkflow'

export default function MonitoringPage() {
  const [isClient, setIsClient] = useState(false)
  React.useEffect(() => setIsClient(true), [])

  return (
    <AppLayout title="Satellite Monitoring">
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
        Satellite Monitoring Pipeline
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Automated STAC acquisition, heuristic detection, change analysis, and alert generation.
      </Typography>
      {isClient && (
        <Card>
          <CardContent>
            <Box sx={{ color: 'text.primary' }}>
              <MonitoringWorkflow />
            </Box>
          </CardContent>
        </Card>
      )}
    </AppLayout>
  )
}
