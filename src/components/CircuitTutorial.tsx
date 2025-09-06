import React, { useState } from 'react'

interface CircuitTutorialProps {
  onClose: () => void
}

export function CircuitTutorial({ onClose }: CircuitTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const steps = [
    {
      title: "Welcome to CircuitWiz!",
      content: "Let's learn how to build a simple LED circuit with proper current limiting.",
      icon: "🎯"
    },
    {
      title: "Step 1: Add a Battery",
      content: "Drag a Battery from the component palette to the grid. This provides power (typically 9V).",
      icon: "🔋"
    },
    {
      title: "Step 2: Add an LED",
      content: "Drag an LED from the component palette. LEDs need current limiting to prevent damage.",
      icon: "💡"
    },
    {
      title: "Step 3: Add a Resistor",
      content: "Drag a Resistor from the component palette. This limits current to safe levels for the LED.",
      icon: "⚡"
    },
    {
      title: "Step 4: Connect with Wires",
      content: "Click on connection points to start wiring. Connect: Battery(+) → Resistor → LED(+) → LED(-) → Battery(-)",
      icon: "🔌"
    },
    {
      title: "Step 5: Calculate Resistor Value",
      content: "For a 9V battery and 2V LED: R = (9V - 2V) / 0.02A = 350Ω. Use 330Ω or 470Ω resistor.",
      icon: "🧮"
    },
    {
      title: "Step 6: Test Your Circuit",
      content: "The electrical validator will show warnings if something's wrong. Green notifications mean success!",
      icon: "✅"
    }
  ]

  const electricalTips = [
    "LEDs typically need 1.8-3.3V and 20mA current",
    "Always use a current limiting resistor with LEDs",
    "Red LEDs: ~1.8V, Green/Yellow: ~2.1V, Blue/White: ~3.3V",
    "Resistor formula: R = (Vsupply - Vled) / Iled",
    "Common resistor values: 220Ω, 330Ω, 470Ω, 1kΩ",
    "Batteries have current limits - check for short circuits",
    "Wires have current ratings - don't exceed them"
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-dark-surface rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Circuit Tutorial: LED + Resistor + Battery
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
            >
              ✕
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(((currentStep + 1) / steps.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Current Step */}
          <div className="mb-6">
            <div className="text-4xl mb-4">{steps[currentStep].icon}</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              {steps[currentStep].title}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {steps[currentStep].content}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex justify-between mb-6">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              ← Previous
            </button>
            <button
              onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
              disabled={currentStep === steps.length - 1}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
            >
              Next →
            </button>
          </div>

          {/* Electrical Tips */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              💡 Electrical Tips
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {electricalTips.map((tip, index) => (
                <div
                  key={index}
                  className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-2 rounded"
                >
                  {tip}
                </div>
              ))}
            </div>
          </div>

          {/* Quick Start */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              🚀 Quick Start
            </h4>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Ready to build?</strong> Close this tutorial and try building the circuit yourself! 
                The electrical validator will guide you with real-time feedback.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
