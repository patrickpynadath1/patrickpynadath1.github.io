"""Build the "See it in the code" snippets for the component figures.

Reads YAML configs and core source from a checkout of the candi repo at a pinned
commit and writes code_refs.json: one entry per figure option, each with the config
file, the Hydra override that selects it, and short code excerpts with GitHub links.

Usage:  python3 code_refs.py /path/to/candi > code_refs.json
Rerun after the code changes, then paste the JSON into the page (see build step).
"""
import ast, json, subprocess, sys, pathlib

REPO = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '../candi-src')
GH = 'https://github.com/patrickpynadath1/candi/blob/{sha}/{path}'
MAX_LINES = 42

# key -> spec. Keys are "<choice key>:<option>", optionally "@<qualifier>" for a variant
# that depends on the corruption (or loss form). The page tries the most specific key first.
#   cfg:  config files shown (path, optional "section" to cut out of a larger YAML)
#   ov:   the command-line override that selects this option
#   code: list of (file, symbol) where symbol is "Class", "Class.method" or "function"
#   note: one plain sentence about where this lives
SPEC = {
    # Representation
    'rep:tokens': dict(cfg=['configs/process/absorbing.yaml'], ov='process=absorbing',
                       code=[('core/models/components.py', 'TokenInput')],
                       note='Discrete processes keep token IDs; the network looks them up in its own embedding table.'),
    'rep:onehot': dict(cfg=['configs/representation/one_hot.yaml'], ov='representation=one_hot',
                       code=[('core/representations/one_hot.py', 'OneHotRepresentation')]),
    'rep:embed': dict(cfg=['configs/representation/embedding.yaml'], ov='representation=embedding',
                      code=[('core/representations/embedding.py', 'EmbeddingRepresentation')]),
    # Corruption
    'corr:masked': dict(cfg=['configs/process/absorbing.yaml'], ov='process=absorbing',
                        code=[('core/processes/absorbing.py', 'AbsorbingProcess.corrupt'), ('core/processes/absorbing.py', 'AbsorbingProcess.reverse')]),
    'corr:uniform': dict(cfg=['configs/process/uniform.yaml'], ov='process=uniform',
                         code=[('core/processes/uniform.py', 'UniformProcess.corrupt'), ('core/processes/uniform.py', 'UniformProcess.reverse_probabilities')]),
    'corr:gidd': dict(cfg=['configs/process/gidd.yaml'], ov='process=gidd',
                      code=[('core/processes/gidd.py', 'GIDDProcess.marginal'), ('core/processes/gidd.py', 'GIDDProcess.reverse_probabilities')]),
    'corr:gaussian': dict(cfg=['configs/process/gaussian.yaml'], ov='process=gaussian',
                          code=[('core/processes/gaussian.py', 'GaussianProcess.forward_distribution'), ('core/processes/gaussian.py', 'GaussianProcess.corrupt'), ('core/processes/gaussian.py', 'GaussianProcess.reverse_vector_field')]),
    'corr:simplex': dict(cfg=['configs/process/dirichlet.yaml'], ov='process=dirichlet',
                         code=[('core/processes/dirichlet.py', 'DirichletProcess.corrupt'), ('core/processes/dirichlet.py', 'DirichletProcess.reverse')]),
    'corr:spherical': dict(cfg=['configs/process/spherical.yaml'], ov='process=spherical',
                           code=[('core/processes/spherical.py', 'slerp'), ('core/processes/spherical.py', 'SphericalProcess.corrupt')]),
    'corr:blurring': dict(cfg=['configs/process/blurring.yaml'], ov='process=blurring',
                          code=[('core/processes/blurring.py', 'BlurringProcess.corrupt')]),
    'combine:*': dict(cfg=['configs/experiment/hybrid.yaml'], ov='+experiment=hybrid',
                      code=[('core/modifiers/hybrid/views.py', 'point'), ('core/modifiers/hybrid/fusion.py', 'GatedFusion.forward')],
                      note='Each view is its own process and schedule; a gated fusion merges what the network sees from both.'),
    # Noise schedule
    'sched:fixed': dict(cfg=['configs/noise_schedule/log_linear.yaml'], ov='noise_schedule=log_linear',
                        code=[('core/noise_schedules/log_linear.py', 'LogLinear')]),
    'sched:fixed@gidd': dict(cfg=['configs/noise_schedule/gidd.yaml'], ov='noise_schedule=gidd',
                             code=[('core/noise_schedules/gidd.py', 'GIDDSchedule')]),
    'sched:fixed@gaussian': dict(cfg=['configs/noise_schedule/gaussian_rank.yaml'], ov='noise_schedule=gaussian_rank',
                                 code=[('core/noise_schedules/gaussian_rank.py', 'OneHotRankSchedule.forward')]),
    'sched:fixed@simplex': dict(cfg=['configs/noise_schedule/simplex.yaml'], ov='noise_schedule=simplex',
                                code=[('core/noise_schedules/simplex.py', 'SimplexSchedule')]),
    'sched:fixed@spherical': dict(cfg=['configs/noise_schedule/spherical.yaml'], ov='noise_schedule=spherical',
                                  code=[('core/noise_schedules/spherical.py', 'SphericalSchedule')]),
    'sched:fixed@blurring': dict(cfg=['configs/noise_schedule/blurring.yaml'], ov='noise_schedule=blurring',
                                 code=[('core/noise_schedules/blurring.py', 'BlurringSchedule.coefficients')]),
    'sched:semi': dict(cfg=['configs/noise_schedule/gumbel.yaml'], ov='noise_schedule=gumbel',
                       code=[('core/noise_schedules/gumbel.py', 'GumbelSchedule.gamma'), ('core/noise_schedules/gumbel.py', 'GumbelSchedule.observe')],
                       note='LangFlow-style: a Gumbel-shaped curve whose location and scale are refit from detached loss feedback.'),
    'sched:full': dict(cfg=['configs/noise_schedule/cdcd_adaptive.yaml'], ov='noise_schedule=cdcd_adaptive',
                       code=[('core/noise_schedules/adaptive/clock.py', 'BufferedAdaptiveSchedule.record_time_loss_pair'), ('core/noise_schedules/adaptive/cdcd.py', 'CDCDAdaptiveSchedule._refit')],
                       note='CDCD-style: losses are binned by time and the curve is refit from them. RePlaid’s learned −log SNR lives in core/noise_schedules/learned_log_snr.py.'),
    'sched:full@gaussian': dict(cfg=['configs/noise_schedule/cdcd_gaussian_adaptive.yaml', 'configs/noise_schedule/learned_log_snr.yaml'], ov='noise_schedule=cdcd_gaussian_adaptive',
                                code=[('core/noise_schedules/adaptive/clock.py', 'BufferedAdaptiveSchedule.record_time_loss_pair'), ('core/noise_schedules/learned_log_snr.py', 'LearnedLogSNRSchedule.gamma')],
                                note='Two fully adaptive options: CDCD’s loss-fitted clock, or RePlaid’s learned −log SNR (noise_schedule=learned_log_snr).'),
    # Network
    'attn:bi': dict(cfg=['configs/model/dit.yaml'], ov='model=dit',
                    code=[('core/models/dit.py', 'DiT.__init__')]),
    'attn:causal': dict(cfg=['configs/model/causal_dit.yaml'], ov='model=causal_dit',
                        code=[('core/models/causal.py', 'CausalDiT.forward')]),
    'tcond:none': dict(cfg=['configs/model/dit.yaml'], ov='model=dit',
                       code=[('core/models/dit.py', 'DiT.prepare_hidden')],
                       note='With adaLN: false the time embedding is never computed, so the network gets no t.'),
    'tcond:on': dict(cfg=['configs/model/dit_conditioned.yaml'], ov='model=dit_conditioned',
                     code=[('core/models/dit.py', 'DiT.prepare_hidden')],
                     note='adaLN: true turns the time t into a conditioning vector that modulates every block.'),
    'self:off': dict(cfg=['configs/sc/off.yaml'], ov='sc=off', code=[]),
    'self:mean': dict(cfg=['configs/sc/on.yaml', ('configs/config.yaml', 'self_conditioning')], ov='sc=on self_conditioning.source=posterior_mean',
                      code=[('core/modifiers/self_conditioning/sources.py', 'posterior_mean'), ('core/models/dit.py', 'DiT.prepare_hidden')],
                      note='softmax(logits) @ E: the previous pass’s probabilities average the embedding table.'),
    'self:hidden': dict(cfg=['configs/sc/on.yaml', ('configs/config.yaml', 'self_conditioning')], ov='sc=on self_conditioning.source=hidden',
                        code=[('core/modifiers/self_conditioning/sources.py', 'final_hidden'), ('core/models/dit.py', 'DiT.prepare_hidden')],
                        note='The raw hidden stream is taken before the LM head and fed back.'),
    # Output
    'param:posterior': dict(cfg=['configs/parameterization/posterior.yaml'], ov='parameterization=posterior',
                            code=[('core/parameterizations/posterior.py', 'PosteriorParameterization.probabilities')]),
    'param:score': dict(cfg=['configs/parameterization/score.yaml'], ov='parameterization=score',
                        code=[('core/parameterizations/score.py', 'AbsorbingScoreParameterization')]),
    'param:plugin': dict(cfg=['configs/parameterization/plug_in.yaml'], ov='parameterization=plug_in',
                         code=[('core/parameterizations/plug_in.py', 'PlugInParameterization.probabilities')]),
    'param:gpost': dict(cfg=['configs/parameterization/gaussian_posterior.yaml', 'configs/parameterization/gaussian_prior.yaml'], ov='parameterization=gaussian_posterior',
                        code=[('core/parameterizations/gaussian_prior.py', 'GaussianPriorPosterior.corrected_logits')]),
    'param:next': dict(cfg=['configs/parameterization/autoregressive.yaml'], ov='parameterization=autoregressive',
                       code=[('core/parameterizations/constraints.py', 'TokenExclusion')]),
    # Loss
    'loss:ce': dict(cfg=['configs/objective/cross_entropy.yaml'], ov='objective=cross_entropy',
                    code=[('core/objectives/cross_entropy.py', 'CrossEntropy.forward')]),
    'loss:elbo': dict(cfg=['configs/objective/weighted_ce.yaml'], ov='objective=weighted_ce',
                      code=[('core/objectives/weighted_ce.py', 'WeightedCrossEntropy')]),
    'loss:elbo@masked': dict(cfg=['configs/objective/weighted_ce.yaml'], ov='objective=weighted_ce',
                             code=[('core/objectives/weighted_ce.py', 'WeightedCrossEntropy')],
                             note='The masked ELBO is cross-entropy weighted by −α′/(1−α), which is 1/t under log-linear.'),
    'loss:elbo@d3pm': dict(cfg=['configs/objective/d3pm.yaml'], ov='objective=d3pm',
                           code=[('core/objectives/d3pm.py', 'D3PMAbsorbingObjective')]),
    'loss:elbo@score': dict(cfg=['configs/objective/score_entropy.yaml'], ov='objective=score_entropy',
                            code=[('core/objectives/score_entropy.py', 'AbsorbingScoreEntropy')]),
    'loss:elbo@uniform': dict(cfg=['configs/objective/uniform.yaml'], ov='objective=uniform',
                              code=[('core/objectives/uniform.py', 'UniformDiffusionObjective.forward')]),
    'loss:elbo@gidd': dict(cfg=['configs/objective/gidd_elbo.yaml'], ov='objective=gidd_elbo',
                           code=[('core/objectives/forward_distribution.py', 'ForwardDistributions.forward'), ('core/objectives/forward_distribution.py', 'ForwardKL')],
                           note='No dedicated class: the ELBO is composed in YAML from forward distributions and a KL term.'),
    'loss:elbo@gaussian': dict(cfg=['configs/objective/replaid.yaml'], ov='objective=replaid',
                               code=[('core/objectives/replaid.py', 'RePlaidObjective')]),
    # Sampler
    'samp:ancestral': dict(cfg=['configs/sampler/ancestral.yaml'], ov='sampler=ancestral',
                           code=[('core/samplers/ancestral.py', 'AbsorbingAncestralUpdate')]),
    'samp:ancestral@uniform': dict(cfg=['configs/sampler/uniform_ancestral.yaml'], ov='sampler=uniform_ancestral',
                                   code=[('core/samplers/uniform_ancestral.py', 'UniformAncestralUpdate')]),
    'samp:eb': dict(cfg=['configs/sampler/entropy_bounded.yaml'], ov='sampler=entropy_bounded',
                    code=[('core/samplers/entropy_bounded.py', 'select_prefix'), ('core/samplers/entropy_bounded.py', 'EntropyBoundedSampler.sample')]),
    'samp:analytic': dict(cfg=['configs/sampler/analytic.yaml'], ov='sampler=analytic',
                          code=[('core/samplers/analytic.py', 'AbsorbingAnalyticUpdate')]),
    'samp:ctmc': dict(cfg=['configs/sampler/dfm.yaml'], ov='sampler=dfm',
                      code=[('core/samplers/discrete_flow.py', 'DiscreteFlowTransition.__call__')]),
    'samp:ode': dict(cfg=['configs/sampler/ode.yaml'], ov='sampler=ode',
                     code=[('core/samplers/ode.py', 'ODESampler.integrate')],
                     note='Euler and Heun are sampler=euler and sampler=heun.'),
    'samp:ddpm': dict(cfg=['configs/sampler/gaussian_ddpm.yaml'], ov='sampler=gaussian_ddpm',
                      code=[('core/samplers/gaussian_ddpm.py', 'GaussianDDPMSampler.sample')]),
    'samp:flow@simplex': dict(cfg=['configs/sampler/simplex.yaml'], ov='sampler=simplex',
                              code=[('core/samplers/simplex.py', 'SimplexBridgeSampler.sample')]),
    'samp:flow@spherical': dict(cfg=['configs/sampler/spherical.yaml', 'configs/sampler/vmf_predictor_corrector.yaml'], ov='sampler=spherical',
                                code=[('core/samplers/spherical.py', 'posterior_velocity'), ('core/samplers/spherical.py', 'SphericalFlowSampler.sample')]),
    'samp:flow@blurring': dict(cfg=['configs/sampler/blur_ancestral.yaml'], ov='sampler=blur_ancestral',
                               code=[('core/samplers/blur_ancestral.py', 'BlurAncestralSampler.sample')]),
    'samp:hybrid': dict(cfg=['configs/sampler/hybrid.yaml'], ov='sampler=hybrid',
                        code=[('core/samplers/hybrid.py', 'HybridSampler'), ('core/samplers/policies.py', 'ReverseTransition.__call__')]),
    'samp:ar': dict(cfg=['configs/sampler/autoregressive.yaml'], ov='sampler=autoregressive',
                    code=[('core/samplers/autoregressive.py', 'AutoregressiveSampler.sample')]),
    # Sequence modifiers
    'block:off': dict(cfg=[('configs/config.yaml', 'block_diffusion')], ov='block_diffusion.enabled=false', code=[]),
    'block:bc': dict(cfg=[('configs/config.yaml', 'block_diffusion')], ov='block_diffusion.enabled=true block_diffusion.x0_causal=false',
                     code=[('core/modifiers/block_diffusion/layout.py', 'make_layout'), ('core/modifiers/block_diffusion/training.py', 'BlockDiffusion.loss')],
                     note='make_layout builds the 2L mask; x0_causal=false makes clean-to-clean attention block causal, as in the BD3-LM paper.'),
    'block:causal': dict(cfg=[('configs/config.yaml', 'block_diffusion')], ov='block_diffusion.enabled=true',
                         code=[('core/modifiers/block_diffusion/layout.py', 'make_layout'), ('core/modifiers/block_diffusion/training.py', 'BlockDiffusion.loss')],
                         note='The default x0_causal=true makes the clean stream token causal, like an ordinary causal LM.'),
    'block:ar': dict(cfg=[('configs/config.yaml', 'block_diffusion')], ov='block_diffusion.enabled=true block_diffusion.clean_loss=autoregressive',
                     code=[('core/modifiers/block_diffusion/training.py', 'BlockDiffusion.loss'), ('core/modifiers/block_diffusion/layout.py', 'make_layout')],
                     note='clean_loss=autoregressive adds next-token cross-entropy on the clean stream (weight: clean_loss_weight). It needs the token-causal context.'),
    'varlen:off': dict(cfg=[], ov='variable_length=null', code=[]),
    'varlen:insert': dict(cfg=['configs/variable_length/insertion.yaml'], ov='variable_length=insertion',
                          code=[('core/modifiers/variable_length/birth.py', 'MaskInsertion'), ('core/modifiers/variable_length/training.py', 'VariableLengthDiffusion.loss')]),
}


RECIPE_IDS = ['mdlm', 'md4', 'radd', 'llada_style', 'ardm_style', 'd3pm_absorb', 'sedd_absorb', 'dfm_masked', 'udlm',
              'uniform_posterior', 'duo', 'dfm_uniform', 'gidd_elbo', 'gidd_corruption', 'candi_hybrid', 'cadd', 'cdcd',
              'flm_gaussian', 'langflow', 'replaid', 'simplex', 'spherical_flow_matching', 'spherical_vmf',
              'blurring_diffusion', 'bd3lm', 'eb_masked', 'flexmdm_style', 'blockgen_masked', 'blockgen_uniform']


def symbol_range(path, symbol):
    tree = ast.parse((REPO / path).read_text())
    parts = symbol.split('.')
    nodes = tree.body
    found = None
    for p in parts:
        found = next((n for n in nodes if isinstance(n, (ast.ClassDef, ast.FunctionDef)) and n.name == p), None)
        if found is None:
            raise KeyError(f'{path}: {symbol}')
        nodes = found.body
    start = min([d.lineno for d in getattr(found, 'decorator_list', [])] + [found.lineno])
    return start, found.end_lineno


def excerpt(path, symbol):
    lines = (REPO / path).read_text().splitlines()
    a, b = symbol_range(path, symbol)
    body = lines[a - 1:b]
    # Dedent methods so they read on their own.
    pad = min((len(l) - len(l.lstrip()) for l in body if l.strip()), default=0)
    body = [l[pad:] for l in body]
    more = 0
    if len(body) > MAX_LINES:
        more = len(body) - MAX_LINES
        body = body[:MAX_LINES] + [f'# … {more} more lines in the file']
    return dict(path=path, symbol=symbol, start=a, end=b, text='\n'.join(body), cut=more)


def yaml_section(path, section):
    lines = (REPO / path).read_text().splitlines()
    out, on = [], False
    for l in lines:
        if l.startswith(section + ':'):
            on = True
        elif on and l and not l.startswith((' ', '#')):
            break
        if on:
            out.append(l)
    start = lines.index(out[0]) + 1
    return '\n'.join(out), start, start + len(out) - 1


def main():
    sha = subprocess.check_output(['git', '-C', str(REPO), 'rev-parse', 'HEAD'], text=True).strip()
    link = lambda p, a=None, b=None: GH.format(sha=sha, path=p) + (f'#L{a}-L{b}' if a else '')
    out = {'sha': sha, 'short': sha[:7], 'entries': {}, 'recipes': {}}
    for key, s in SPEC.items():
        cfgs = []
        for c in s.get('cfg', []):
            if isinstance(c, tuple):
                text, a, b = yaml_section(*c)
                cfgs.append(dict(path=c[0], text=text, url=link(c[0], a, b), section=c[1], start=a))
            else:
                cfgs.append(dict(path=c, text=(REPO / c).read_text().rstrip(), url=link(c), start=1))
        code = []
        for f, sym in s.get('code', []):
            e = excerpt(f, sym)
            e['url'] = link(f, e['start'], e['end'])
            code.append(e)
        out['entries'][key] = dict(ov=s['ov'], note=s.get('note', ''), cfg=cfgs, code=code)
    for name in RECIPE_IDS:
        y = REPO / 'configs/experiment' / (name + '.yaml')
        p = str(y.relative_to(REPO))
        out['recipes'][y.stem] = dict(path=p, text=y.read_text().rstrip(), url=link(p), start=1)
    json.dump(out, sys.stdout, ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main()
