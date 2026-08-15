import React, { useRef, useEffect, useCallback } from 'react';
import get from 'lodash/get';
import debounce from 'lodash/debounce';
import { useFormik } from 'formik';
import { useSelector, useDispatch } from 'react-redux';
import { savePreferences } from 'providers/ReduxStore/slices/app';
import StyledWrapper from './StyledWrapper';
import * as Yup from 'yup';
import toast from 'react-hot-toast';

const General = () => {
  const preferences = useSelector((state) => state.app.preferences);
  const dispatch = useDispatch();

  const preferencesSchema = Yup.object().shape({
    sslVerification: Yup.boolean(),
    storeCookies: Yup.boolean(),
    sendCookies: Yup.boolean(),
    timeout: Yup.mixed()
      .transform((value, originalValue) => {
        return originalValue === '' ? undefined : value;
      })
      .nullable()
      .test('isNumber', 'Request Timeout must be a number', (value) => {
        return value === undefined || !isNaN(value);
      })
      .test('isValidTimeout', 'Request Timeout must be equal or greater than 0', (value) => {
        return value === undefined || Number(value) >= 0;
      }),
    autoSave: Yup.object({
      enabled: Yup.boolean(),
      interval: Yup.mixed()
        .transform((value, originalValue) => {
          return originalValue === '' ? undefined : value;
        })
        .test('isNumber', 'Save Delay must be a number', (value) => {
          return value === undefined || !isNaN(value);
        })
        .test('isValidInterval', 'Save Delay must be at least 500ms', (value) => {
          return value === undefined || Number(value) >= 500;
        })
    }).test('intervalRequired', 'Save Delay is required when Auto Save is enabled', (value) => {
      // If autosave is enabled, interval must be provided
      if (value.enabled && (value.interval === undefined || value.interval === '')) {
        return false;
      }
      return true;
    }),
    defaultLocation: Yup.string().max(1024)
  });

  const formik = useFormik({
    initialValues: {
      sslVerification: preferences.request.sslVerification,
      timeout: preferences.request.timeout,
      storeCookies: get(preferences, 'request.storeCookies', true),
      sendCookies: get(preferences, 'request.sendCookies', true),
      autoSave: {
        enabled: get(preferences, 'autoSave.enabled', false),
        interval: get(preferences, 'autoSave.interval', 1000)
      },
      defaultLocation: get(preferences, 'general.defaultLocation', '')
    },
    validationSchema: preferencesSchema,
    onSubmit: async (values) => {
      try {
        const newPreferences = await preferencesSchema.validate(values, { abortEarly: true });
        handleSave(newPreferences);
      } catch (error) {
        console.error('Preferences validation error:', error.message);
      }
    }
  });

  const handleSave = useCallback((newPreferences) => {
    dispatch(
      savePreferences({
        ...preferences,
        request: {
          ...preferences.request,
          sslVerification: newPreferences.sslVerification,
          timeout: newPreferences.timeout,
          storeCookies: newPreferences.storeCookies,
          sendCookies: newPreferences.sendCookies
        },
        autoSave: {
          enabled: newPreferences.autoSave.enabled,
          interval: newPreferences.autoSave.interval
        },
        general: {
          defaultLocation: newPreferences.defaultLocation
        }
      }))
      .catch((err) => console.log(err) && toast.error('Failed to update preferences'));
  }, [dispatch, preferences]);

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const debouncedSave = useCallback(
    debounce((values) => {
      preferencesSchema.validate(values, { abortEarly: true })
        .then((validatedValues) => {
          handleSaveRef.current(validatedValues);
        })
        .catch((error) => {
        });
    }, 500),
    []
  );

  useEffect(() => {
    if (formik.dirty && formik.isValid) {
      debouncedSave(formik.values);
    }
    return () => {
      debouncedSave.flush();
    };
  }, [formik.values, formik.dirty, formik.isValid, debouncedSave]);

  return (
    <StyledWrapper className="w-full">
      <div className="section-header">General Settings</div>
      <form className="bruno-form" onSubmit={formik.handleSubmit}>
        <div className="flex items-center mb-2">
          <input
            id="sslVerification"
            type="checkbox"
            name="sslVerification"
            checked={formik.values.sslVerification}
            onChange={formik.handleChange}
            className="mousetrap mr-0"
          />
          <label className="block ml-2 select-none" htmlFor="sslVerification">
            SSL/TLS Certificate Verification
          </label>
        </div>
        <div className="flex items-center mt-2">
          <input
            id="storeCookies"
            type="checkbox"
            name="storeCookies"
            checked={formik.values.storeCookies}
            onChange={formik.handleChange}
            className="mousetrap mr-0"
          />
          <label className="block ml-2 select-none" htmlFor="storeCookies">
            Store Cookies automatically
          </label>
        </div>
        <div className="flex items-center mt-2">
          <input
            id="sendCookies"
            type="checkbox"
            name="sendCookies"
            checked={formik.values.sendCookies}
            onChange={formik.handleChange}
            className="mousetrap mr-0"
          />
          <label className="block ml-2 select-none" htmlFor="sendCookies">
            Send Cookies automatically
          </label>
        </div>
        <div className="flex flex-col mt-6">
          <label className="block select-none" htmlFor="timeout">
            Request Timeout (in ms)
          </label>
          <input
            type="text"
            name="timeout"
            className="block textbox mt-2 w-16"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            onChange={formik.handleChange}
            value={formik.values.timeout}
          />
        </div>
        {formik.touched.timeout && formik.errors.timeout ? (
          <div className="text-red-500">{formik.errors.timeout}</div>
        ) : null}
        <div className="flex items-center mt-6">
          <input
            id="autoSaveEnabled"
            type="checkbox"
            name="autoSave.enabled"
            checked={formik.values.autoSave.enabled}
            onChange={formik.handleChange}
            className="mousetrap mr-0"
          />
          <label className="block ml-2 select-none" htmlFor="autoSaveEnabled">
            Enable Auto Save
          </label>
        </div>
        <div className={`flex flex-col mt-2 ${!formik.values.autoSave.enabled ? 'opacity-50' : ''}`}>
          <label className="block select-none" htmlFor="autoSaveInterval">
            Save Delay (in ms)
          </label>
          <input
            type="text"
            name="autoSave.interval"
            id="autoSaveInterval"
            className="block textbox mt-2 w-24"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            onChange={formik.handleChange}
            value={formik.values.autoSave.interval}
            disabled={!formik.values.autoSave.enabled}
          />
        </div>
        {formik.touched.autoSave && formik.errors.autoSave && typeof formik.errors.autoSave === 'string' && (
          <div className="text-red-500">{formik.errors.autoSave}</div>
        )}
        {formik.touched.autoSave?.interval && formik.errors.autoSave?.interval && (
          <div className="text-red-500">{formik.errors.autoSave.interval}</div>
        )}
        <div className="flex flex-col mt-6">
          <label className="block select-none default-location-label" htmlFor="defaultLocation">
            Default Location
          </label>
          <p className="text-muted mt-1 text-xs">
            Used as the default location for new workspaces and collections
          </p>
          <input
            type="text"
            name="defaultLocation"
            id="defaultLocation"
            className="block textbox mt-2 w-full default-location-input"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            onChange={formik.handleChange}
            value={formik.values.defaultLocation || ''}
            placeholder="Enter a default location"
          />
        </div>
        {formik.touched.defaultLocation && formik.errors.defaultLocation ? (
          <div className="text-red-500">{formik.errors.defaultLocation}</div>
        ) : null}
      </form>
    </StyledWrapper>
  );
};

export default General;
