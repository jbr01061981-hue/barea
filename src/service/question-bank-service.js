const { QuestionStatus } = require('../domain/question');

class QuestionBankService {
  constructor(questionRepository) {
    this.repo = questionRepository;
  }

  createQuestion(data) {
    return this.repo.create(data);
  }

  getQuestion(organizationId, id) {
    return this.repo.findById(organizationId, id);
  }

  updateQuestion(organizationId, id, updates) {
    return this.repo.update(organizationId, id, updates);
  }

  listQuestions(organizationId, filter = {}) {
    return this.repo.list(organizationId, filter);
  }

  listApprovedQuestions(organizationId, filter = {}) {
    return this.repo.list(organizationId, Object.assign({}, filter, { status: QuestionStatus.APPROVED }));
  }

  transitionStatus(organizationId, id, nextStatus) {
    return this.repo.transitionStatus(organizationId, id, nextStatus);
  }
}

module.exports = {
  QuestionBankService
};
