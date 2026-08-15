import React, { useState } from 'react';
import Modal from 'components/Modal';
import Button from 'ui/Button';
import { IconCheck } from '@tabler/icons';
import StyledWrapper from './StyledWrapper';
import exportOpenCollection from 'utils/exporters/opencollection';
import { cloneDeep } from 'lodash';
import { transformCollectionToSaveToExportAsFile } from 'utils/collections/index';
import { useSelector } from 'react-redux';
import { findCollectionByUid, areItemsLoading } from 'utils/collections/index';

const EXPORT_FORMATS = {
  YAML: 'yaml'
};

const ShareCollection = ({ onClose, collectionUid }) => {
  const collection = useSelector((state) => findCollectionByUid(state.collections.collections, collectionUid));
  const isCollectionLoading = areItemsLoading(collection);
  const [selectedFormat, setSelectedFormat] = useState(EXPORT_FORMATS.YAML);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportYaml = () => {
    const collectionCopy = cloneDeep(collection);
    exportOpenCollection(transformCollectionToSaveToExportAsFile(collectionCopy));
  };

  const handleProceed = async () => {
    if (isCollectionLoading || isExporting) return;

    setIsExporting(true);
    try {
      handleExportYaml();
      onClose();
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const isDisabled = isCollectionLoading || isExporting;

  return (
    <>
      <Modal size="lg" title="Share Collection" handleCancel={onClose} hideFooter>
        <StyledWrapper className="flex flex-col">
          <p className="text-sm mb-4">
            Bruno uses{' '}
            <a
              href="https://opencollection.com"
              target="_blank"
              rel="noopener noreferrer"
              className="opencollection-link"
            >
              OpenCollection
            </a>
            {' '}- An open format for API collections
          </p>

          {/* Bruno Format Section */}
          <div className="section-title">Bruno Format</div>
          <div className="bruno-format-grid mb-6">
            {/* Single File YAML Option */}
            <div
              className={`format-card ${selectedFormat === EXPORT_FORMATS.YAML ? 'selected' : ''} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => !isDisabled && setSelectedFormat(EXPORT_FORMATS.YAML)}
            >
              <div className="card-header">
                <span className="card-title">Single File (YAML)</span>
              </div>
              <p className="card-description">OpenCollection format bundled into one .yml file</p>
              <div className="feature-list">
                <div className="feature-item">
                  <IconCheck size={14} className="checkmark" />
                  <span>Everything in a single YAML file</span>
                </div>
                <div className="feature-item">
                  <IconCheck size={14} className="checkmark" />
                  <span>Paste in a gist or attach to an issue</span>
                </div>
              </div>
              <p className="best-for">Best for: Quick sharing as a single file</p>
            </div>
          </div>

          <div className="modal-footer">
            <Button
              onClick={handleProceed}
              disabled={isDisabled}
              loading={isExporting}
            >
              {isExporting ? 'Exporting...' : 'Proceed'}
            </Button>
          </div>
        </StyledWrapper>
      </Modal>
    </>
  );
};

export default ShareCollection;
