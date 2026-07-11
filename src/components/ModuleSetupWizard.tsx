import React from 'react'
import type { ModuleSetupWizardSession } from '../workspace/module-setup-wizard.types'

type Props = {
  session: ModuleSetupWizardSession
  onComplete: () => void
}

export default function ModuleSetupWizard({ session, onComplete }: Props){
  const steps = React.useMemo(() => (
    [...session.definition.steps].sort((first, second) => first.displayOrder - second.displayOrder)
  ), [session.definition.steps])
  const [activeStepIndex, setActiveStepIndex] = React.useState(0)
  const activeStep = steps[activeStepIndex]
  const isFirstStep = activeStepIndex === 0
  const isLastStep = activeStepIndex === steps.length - 1

  const goBack = () => setActiveStepIndex(current => Math.max(0, current - 1))
  const goNext = () => {
    if(isLastStep){
      onComplete()
      return
    }

    setActiveStepIndex(current => Math.min(steps.length - 1, current + 1))
  }

  return (
    <section className="module-setup-wizard" aria-label={`${session.module.name} başlangıç sihirbazı`}>
      <div className="module-setup-wizard-header">
        <span className="marketplace-module-icon" aria-hidden="true">{session.module.icon}</span>
        <div>
          <span className="status-pill info-pill">Modül Başlangıç Sihirbazı</span>
          <h3>{session.definition.title}</h3>
          <p>{session.definition.description}</p>
        </div>
      </div>

      <div className="module-setup-progress" aria-label="Kurulum adımları">
        {steps.map((step, index) => (
          <button
            key={step.id}
            type="button"
            className={`module-setup-step ${index === activeStepIndex ? 'active' : ''} ${index < activeStepIndex ? 'done' : ''}`}
            onClick={() => setActiveStepIndex(index)}
          >
            <span>{index + 1}</span>
            <strong>{step.title}</strong>
          </button>
        ))}
      </div>

      <article className="module-setup-step-panel">
        <span className="status-pill muted-pill">Altyapı hazır</span>
        <h4>{activeStep.title}</h4>
        <p>{activeStep.description}</p>
        {activeStep.placeholder && (
          <div className="module-setup-placeholder">
            <strong>Placeholder</strong>
            <span>{activeStep.placeholder}</span>
          </div>
        )}
      </article>

      <div className="module-setup-actions">
        <button className="btn" type="button" disabled={isFirstStep} onClick={goBack}>
          Geri
        </button>
        <button className="btn primary" type="button" onClick={goNext}>
          {isLastStep ? 'Kontrol Paneline Git' : 'İleri'}
        </button>
      </div>
    </section>
  )
}
